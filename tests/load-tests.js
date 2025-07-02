const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class LoadTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `load-test-${this.timestamp}.json`);
        this.kubeconfig = process.env.KUBECONFIG || '~/livekit-demo-k8s.config';
        
        this.results = {
            timestamp: this.timestamp,
            test_type: 'load_tests',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                success_rate: '0%'
            }
        };

        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async addTestResult(name, status, details, duration, metrics = null) {
        this.results.summary.total++;
        if (status === 'PASS') {
            this.results.summary.passed++;
        }

        this.results.tests.push({
            name,
            status,
            details,
            duration: `${duration}ms`,
            metrics: metrics || null
        });

        console.log(`${status === 'PASS' ? '✅' : '❌'} ${name}: ${details}`);
    }

    async getCredentials() {
        try {
            const keysYaml = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get secret livekit-keys-file -o jsonpath="{.data.keys\\.yaml}" -n livekit | base64 -d`,
                { encoding: 'utf8' }
            ).trim();
            
            // Parse the keys.yaml format: "LKAPIy5Cs2MTiKm53mrh1: LMLYiFEs1Vb3lwJbjayZkH6NdsXS86d0d1Oh36V2"
            const [apiKey, apiSecret] = keysYaml.split(':').map(s => s.trim());
            
            return { apiKey, apiSecret };
        } catch (error) {
            console.warn('⚠️ Could not retrieve credentials from K8s secrets, using fallback');
            return { 
                apiKey: 'test', 
                apiSecret: 'ThisIsAVeryLongSecretKeyForLiveKitThatIsAtLeast32Characters'
            };
        }
    }

    async checkPodScale() {
        console.log('📊 Checking current pod scale...');
        try {
            const livekitPods = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get pods -n livekit --field-selector=status.phase=Running --no-headers | wc -l`,
                { encoding: 'utf8' }
            ).trim();
            
            const ingressPods = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get pods -n livekit -l app.kubernetes.io/name=livekit-ingress --field-selector=status.phase=Running --no-headers | wc -l`,
                { encoding: 'utf8' }
            ).trim();
            
            const redisPods = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get pods -n redis --field-selector=status.phase=Running --no-headers | wc -l`,
                { encoding: 'utf8' }
            ).trim();
            
            return {
                livekit: parseInt(livekitPods),
                ingress: parseInt(ingressPods),
                redis: parseInt(redisPods)
            };
        } catch (error) {
            console.warn('⚠️ Could not check pod scale:', error.message);
            return { livekit: 0, ingress: 0, redis: 0 };
        }
    }

    async runLiveKitLoadTest(participants = 100, publishers = 20, duration = '2m') {
        console.log(`🧪 Running LiveKit Load Test (${participants} participants, ${publishers} publishers)...`);
        const startTime = Date.now();
        
        try {
            const { apiKey, apiSecret } = await this.getCredentials();
            const preTestScale = await this.checkPodScale();
            
            const testRoom = `load-test-${Date.now()}`;
            const subscribers = participants - publishers;
            
            const command = `
KUBECONFIG=${this.kubeconfig} kubectl run livekit-load-test-${Date.now()} --rm -i --tty --image=livekit/livekit-cli \\
  --restart=Never --timeout=600s \\
  --command -- /bin/bash -c "
  livekit-cli load-test \\
    --url wss://livekit.livekit-demo.cloudportal.app \\
    --api-key '${apiKey}' \\
    --api-secret '${apiSecret}' \\
    --room '${testRoom}' \\
    --publishers ${publishers} \\
    --subscribers ${subscribers} \\
    --duration ${duration} \\
    --video-resolution 720p \\
    --video-fps 30 \\
    --verbose
  "
            `.trim();

            console.log(`🚀 Starting load test with ${participants} participants...`);
            
            const result = execSync(command, { 
                encoding: 'utf8',
                timeout: 600000, // 10 minutes
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer
            });
            
            // Wait a moment for scaling to occur
            await new Promise(resolve => setTimeout(resolve, 30000));
            const postTestScale = await this.checkPodScale();
            
            const duration_ms = Date.now() - startTime;
            
            // Parse results from output
            const metrics = this.parseLoadTestOutput(result);
            
            const scalingOccurred = postTestScale.livekit > preTestScale.livekit || 
                                  postTestScale.ingress > preTestScale.ingress;
            
            const testDetails = `
Participants: ${participants} (${publishers} publishers, ${subscribers} subscribers)
Pre-test pods: LK=${preTestScale.livekit}, Ingress=${preTestScale.ingress}, Redis=${preTestScale.redis}
Post-test pods: LK=${postTestScale.livekit}, Ingress=${postTestScale.ingress}, Redis=${postTestScale.redis}
Scaling occurred: ${scalingOccurred}
${metrics.summary || 'Test completed'}
            `.trim();
            
            await this.addTestResult(
                `Load Test ${participants} Participants`,
                metrics.success ? 'PASS' : 'FAIL',
                testDetails,
                duration_ms,
                {
                    participants,
                    publishers,
                    subscribers,
                    preTestScale,
                    postTestScale,
                    scalingOccurred,
                    ...metrics
                }
            );
            
            return metrics.success;
        } catch (error) {
            const duration_ms = Date.now() - startTime;
            await this.addTestResult(
                `Load Test ${participants} Participants`,
                'FAIL',
                `Load test failed: ${error.message.substring(0, 500)}`,
                duration_ms
            );
            return false;
        }
    }

    parseLoadTestOutput(output) {
        const metrics = {
            success: false,
            summary: '',
            connectionsSuccessful: 0,
            connectionsFailed: 0,
            averageLatency: 0,
            errors: []
        };
        
        try {
            // Look for success indicators
            if (output.includes('load test completed') || output.includes('Test completed successfully')) {
                metrics.success = true;
            }
            
            // Extract connection stats
            const connectionMatch = output.match(/(\d+) successful.*?(\d+) failed/i);
            if (connectionMatch) {
                metrics.connectionsSuccessful = parseInt(connectionMatch[1]);
                metrics.connectionsFailed = parseInt(connectionMatch[2]);
            }
            
            // Extract latency if available
            const latencyMatch = output.match(/average.*?latency.*?(\d+)ms/i);
            if (latencyMatch) {
                metrics.averageLatency = parseInt(latencyMatch[1]);
            }
            
            // Extract errors
            const errorLines = output.split('\n').filter(line => 
                line.toLowerCase().includes('error') || 
                line.toLowerCase().includes('failed') ||
                line.toLowerCase().includes('timeout')
            );
            metrics.errors = errorLines.slice(0, 5); // Limit to 5 errors
            
            // Create summary
            metrics.summary = `Connections: ${metrics.connectionsSuccessful} successful, ${metrics.connectionsFailed} failed`;
            if (metrics.averageLatency > 0) {
                metrics.summary += `, Avg latency: ${metrics.averageLatency}ms`;
            }
            
            // Success criteria: more successful than failed connections
            if (metrics.connectionsSuccessful > metrics.connectionsFailed) {
                metrics.success = true;
            }
            
        } catch (error) {
            metrics.summary = `Error parsing output: ${error.message}`;
        }
        
        return metrics;
    }

    async testAutoScaling() {
        console.log('🧪 Testing Auto-scaling Behavior...');
        const startTime = Date.now();
        
        try {
            const initialScale = await this.checkPodScale();
            console.log(`Initial scale: LK=${initialScale.livekit}, Ingress=${initialScale.ingress}`);
            
            // Run multiple concurrent smaller tests to trigger scaling
            const promises = [];
            const testCount = 3;
            const participantsPerTest = 50;
            
            for (let i = 0; i < testCount; i++) {
                const promise = this.runSingleConcurrentTest(participantsPerTest, `30s`, i);
                promises.push(promise);
                
                // Stagger the start slightly
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
            
            await Promise.all(promises);
            
            // Check final scale
            await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for scaling
            const finalScale = await this.checkPodScale();
            
            const duration_ms = Date.now() - startTime;
            const scalingOccurred = finalScale.livekit > initialScale.livekit;
            
            await this.addTestResult(
                'Auto-scaling Test',
                scalingOccurred ? 'PASS' : 'FAIL',
                `Initial: LK=${initialScale.livekit}, Final: LK=${finalScale.livekit}. Scaling: ${scalingOccurred}`,
                duration_ms,
                { initialScale, finalScale, scalingOccurred }
            );
            
            return scalingOccurred;
        } catch (error) {
            const duration_ms = Date.now() - startTime;
            await this.addTestResult(
                'Auto-scaling Test',
                'FAIL',
                `Auto-scaling test failed: ${error.message}`,
                duration_ms
            );
            return false;
        }
    }

    async runSingleConcurrentTest(participants, duration, testId) {
        const { apiKey, apiSecret } = await this.getCredentials();
        const testRoom = `concurrent-test-${testId}-${Date.now()}`;
        const publishers = Math.floor(participants / 5);
        const subscribers = participants - publishers;
        
        try {
            const command = `
KUBECONFIG=${this.kubeconfig} kubectl run livekit-concurrent-test-${testId}-${Date.now()} --rm -i --tty --image=livekit/livekit-cli \\
  --restart=Never --timeout=300s \\
  --command -- /bin/bash -c "
  livekit-cli load-test \\
    --url wss://livekit.livekit-demo.cloudportal.app \\
    --api-key '${apiKey}' \\
    --api-secret '${apiSecret}' \\
    --room '${testRoom}' \\
    --publishers ${publishers} \\
    --subscribers ${subscribers} \\
    --duration ${duration} \\
    --video-resolution 480p
  " > /dev/null 2>&1
            `.trim();
            
            execSync(command, { timeout: 300000 });
            return true;
        } catch (error) {
            console.warn(`Concurrent test ${testId} failed:`, error.message.substring(0, 100));
            return false;
        }
    }

    async saveResults() {
        this.results.summary.failed = this.results.summary.total - this.results.summary.passed;
        this.results.summary.success_rate = `${Math.round((this.results.summary.passed / this.results.summary.total) * 100)}%`;
        
        fs.writeFileSync(this.resultsFile, JSON.stringify(this.results, null, 2));
        
        console.log('\n📊 Load Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }

    async runAllLoadTests() {
        try {
            console.log('🎯 Starting Load Tests...\n');
            
            // Progressive load tests
            const testSizes = [50, 100, 200, 400];
            
            for (const size of testSizes) {
                const success = await this.runLiveKitLoadTest(size, Math.floor(size / 5), '2m');
                
                if (!success && size > 100) {
                    console.log(`⚠️ Load test with ${size} participants failed, stopping progression`);
                    break;
                }
                
                // Wait between tests
                console.log('⏱️ Waiting 60s between tests...');
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
            
            // Test auto-scaling
            await this.testAutoScaling();
            
            await this.saveResults();
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All load tests passed!');
                return true;
            } else {
                console.log('⚠️ Some load tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during load testing:', error);
            return false;
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new LoadTester();
    tester.runAllLoadTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = LoadTester;