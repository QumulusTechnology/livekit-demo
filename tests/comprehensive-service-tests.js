const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ComprehensiveServiceTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `comprehensive-service-tests-${this.timestamp}.json`);
        this.kubeconfig = process.env.KUBECONFIG || '~/livekit-demo-k8s.config';
        
        this.results = {
            timestamp: this.timestamp,
            test_type: 'comprehensive_service_tests',
            tests: [],
            services: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                success_rate: '0%'
            }
        };
        
        this.browser = null;
        this.page = null;

        // Comprehensive service configurations based on README
        this.serviceConfigs = {
            'livekit-server': {
                name: 'LiveKit Server',
                url: 'wss://livekit.livekit-demo.cloudportal.app',
                namespace: 'livekit',
                testType: 'websocket',
                description: 'Core LiveKit server for WebRTC connections',
                capacity: '15-60 pods, autoscaling for 1000+ participants',
                tests: ['websocket_connection', 'pod_health', 'scaling_metrics']
            },
            'livekit-ingress': {
                name: 'LiveKit Ingress',
                url: 'https://ingress.livekit-demo.cloudportal.app',
                namespace: 'livekit',
                testType: 'api',
                description: 'Streaming ingress for RTMP/WHIP protocols',
                capacity: '8-32 pods, optimized for high-throughput streaming',
                tests: ['api_health', 'pod_health', 'rtmp_connectivity']
            },
            'meet-client': {
                name: 'Meet Client',
                url: 'https://meet.livekit-demo.cloudportal.app',
                namespace: 'meet-client',
                testType: 'web_ui',
                description: 'React-based video conferencing interface',
                expectedElements: ['body', 'script', '#root'],
                tests: ['ui_loading', 'performance_metrics', 'responsiveness']
            },
            'redis-cluster': {
                name: 'Redis Cluster',
                namespace: 'redis',
                testType: 'internal',
                description: '6-node Redis cluster for distributed state',
                expectedPods: 6,
                tests: ['pod_health', 'cluster_connectivity', 'performance']
            },
            'harbor': {
                name: 'Harbor Container Registry',
                url: 'https://repo.livekit-demo.cloudportal.app',
                namespace: 'harbor',
                testType: 'web_ui',
                description: 'Container image registry for storing and managing Docker images',
                expectedElements: ['input[placeholder*="username"], input[placeholder*="Username"]'],
                tests: ['ui_loading', 'api_health', 'registry_functionality']
            },
            'minio-console': {
                name: 'MinIO Console',
                url: 'https://s3.livekit-demo.cloudportal.app',
                namespace: 'minio-tenant',
                testType: 'web_ui',
                description: 'S3-compatible object storage console',
                expectedElements: ['input[placeholder*="Username"], input[placeholder*="username"]'],
                tests: ['ui_loading', 'authentication_form', 'storage_metrics']
            },
            'minio-api': {
                name: 'MinIO API',
                url: 'https://s3api.livekit-demo.cloudportal.app',
                namespace: 'minio-tenant',
                testType: 'api',
                description: 'S3 API for object storage operations',
                tests: ['api_health', 's3_compatibility', 'bucket_operations']
            },
            'minio-operator': {
                name: 'MinIO Operator',
                url: 'https://minio-operator.livekit-demo.cloudportal.app',
                namespace: 'minio-operator',
                testType: 'web_ui',
                description: 'MinIO operator interface for cluster management',
                expectedElements: ['body'],
                tests: ['ui_loading', 'operator_status']
            },
            'meet-client': {
                name: 'Meet Client Frontend',
                url: 'https://meet.livekit-demo.cloudportal.app',
                namespace: 'meet-client',
                testType: 'web_ui',
                description: 'Video conferencing client interface',
                expectedElements: ['body', 'script'],
                tests: ['ui_loading', 'livekit_integration', 'media_permissions']
            },
            'trivoh-frontend': {
                name: 'Trivoh Frontend',
                url: 'https://trivoh.livekit-demo.cloudportal.app',
                namespace: 'trivoh',
                testType: 'web_ui',
                description: 'Custom application frontend',
                expectedElements: ['body', 'script'],
                tests: ['ui_loading', 'api_connectivity', 'performance']
            },
            'trivoh-api': {
                name: 'Trivoh API',
                url: 'https://api.livekit-demo.cloudportal.app',
                namespace: 'trivoh-api',
                testType: 'api',
                description: 'Custom application backend API',
                tests: ['api_health', 'database_connectivity', 'performance']
            },
            'grafana': {
                name: 'Grafana Dashboard',
                url: 'https://grafana.livekit-demo.cloudportal.app',
                namespace: 'grafana',
                testType: 'web_ui',
                description: 'Monitoring and visualization dashboard',
                expectedElements: ['input[name="user"]', 'input[name="password"]'],
                tests: ['ui_loading', 'datasource_connectivity', 'dashboard_availability']
            },
            'loki': {
                name: 'Loki Log Aggregation',
                url: 'https://gateway-loki.livekit-demo.cloudportal.app',
                namespace: 'loki',
                testType: 'api',
                description: 'Log aggregation and storage system',
                tests: ['api_health', 'log_ingestion', 'query_performance']
            },
            'mimir': {
                name: 'Mimir Metrics Storage',
                url: 'https://mimir.livekit-demo.cloudportal.app',
                namespace: 'mimir',
                testType: 'api',
                description: 'Long-term metrics storage (Prometheus-compatible)',
                tests: ['api_health', 'metrics_ingestion', 'query_performance']
            },
            'argocd': {
                name: 'ArgoCD GitOps',
                url: 'https://argocd.livekit-demo.cloudportal.app',
                namespace: 'argocd',
                testType: 'web_ui',
                description: 'GitOps deployment management',
                expectedElements: ['input[type="password"]', 'button[type="submit"]'],
                tests: ['ui_loading', 'application_sync_status', 'repository_connectivity']
            }
        };

        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async addTestResult(serviceName, testName, status, details, duration, metrics = null) {
        this.results.summary.total++;
        if (status === 'PASS') {
            this.results.summary.passed++;
        }

        if (!this.results.services[serviceName]) {
            this.results.services[serviceName] = { tests: [], summary: { total: 0, passed: 0 } };
        }

        this.results.services[serviceName].tests.push({
            test_name: testName,
            status,
            details,
            duration: `${duration}ms`,
            metrics: metrics || null
        });

        this.results.services[serviceName].summary.total++;
        if (status === 'PASS') {
            this.results.services[serviceName].summary.passed++;
        }

        this.results.tests.push({
            service: serviceName,
            test_name: testName,
            status,
            details,
            duration: `${duration}ms`,
            metrics: metrics || null
        });

        console.log(`${status === 'PASS' ? '✅' : '❌'} ${serviceName} - ${testName}: ${details}`);
    }

    async setup() {
        console.log('🚀 Setting up Comprehensive Service Testing...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--allow-running-insecure-content',
                '--disable-web-security',
                '--ignore-certificate-errors',
                '--ignore-ssl-errors',
                '--ignore-certificate-errors-spki-list'
            ]
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1920, height: 1080 });
        await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async testPodHealth(serviceName, config) {
        console.log(`🧪 Testing pod health for ${serviceName}...`);
        const startTime = Date.now();
        
        try {
            const podsOutput = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get pods -n ${config.namespace} --no-headers 2>/dev/null || echo "namespace-not-found"`,
                { encoding: 'utf8', timeout: 10000 }
            );
            
            const duration = Date.now() - startTime;
            
            if (podsOutput.trim() === 'namespace-not-found' || !podsOutput.trim()) {
                await this.addTestResult(serviceName, 'Pod Health', 'FAIL', 'Namespace not found or no pods', duration);
                return false;
            }
            
            const pods = podsOutput.trim().split('\n');
            const runningPods = pods.filter(pod => pod.includes('Running') || pod.includes('Completed')).length;
            const totalPods = pods.length;
            
            let expectedPods = config.expectedPods || 1;
            if (serviceName === 'redis-cluster') expectedPods = 6;
            else if (serviceName === 'livekit-server') expectedPods = 8; // Minimum expected
            
            const isHealthy = runningPods >= expectedPods && (runningPods / totalPods) >= 0.8;
            
            await this.addTestResult(
                serviceName, 
                'Pod Health', 
                isHealthy ? 'PASS' : 'FAIL',
                `${runningPods}/${totalPods} pods running (expected: ${expectedPods}+)`,
                duration,
                { runningPods, totalPods, expectedPods, healthRate: (runningPods / totalPods) * 100 }
            );
            
            return isHealthy;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(serviceName, 'Pod Health', 'FAIL', `Error: ${error.message}`, duration);
            return false;
        }
    }

    async testWebUIService(serviceName, config) {
        console.log(`🧪 Testing web UI for ${serviceName}...`);
        const startTime = Date.now();
        
        try {
            const response = await this.page.goto(config.url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            const statusCode = response.status();
            let elementCheck = { found: 0, total: 0, details: [] };
            
            if (config.expectedElements && config.expectedElements.length > 0) {
                for (const selector of config.expectedElements) {
                    try {
                        const element = await this.page.$(selector);
                        elementCheck.total++;
                        if (element) {
                            elementCheck.found++;
                            elementCheck.details.push(`${selector}: Found`);
                        } else {
                            elementCheck.details.push(`${selector}: Not found`);
                        }
                    } catch (err) {
                        elementCheck.total++;
                        elementCheck.details.push(`${selector}: Error`);
                    }
                }
            } else {
                const bodyText = await this.page.evaluate(() => document.body.textContent.length);
                elementCheck = { 
                    found: bodyText > 100 ? 1 : 0, 
                    total: 1, 
                    details: [`Content: ${bodyText > 100 ? 'Present' : 'Minimal'} (${bodyText} chars)`] 
                };
            }
            
            const duration = Date.now() - startTime;
            const isSuccess = statusCode < 400 && (elementCheck.found >= Math.ceil(elementCheck.total / 2));
            
            await this.addTestResult(
                serviceName,
                'Web UI Loading',
                isSuccess ? 'PASS' : 'FAIL',
                `${config.description} (${statusCode}): ${elementCheck.details.join(', ')}`,
                duration,
                { statusCode, elementCheck, responseTime: duration }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(serviceName, 'Web UI Loading', 'FAIL', `Error: ${error.message}`, duration);
            return false;
        }
    }

    async testAPIService(serviceName, config) {
        console.log(`🧪 Testing API for ${serviceName}...`);
        const startTime = Date.now();
        
        try {
            let testUrl = config.url;
            if (serviceName === 'livekit-ingress') testUrl += '/health';
            else if (serviceName === 'trivoh-api') testUrl += '/health';
            else if (serviceName === 'loki') testUrl += '/ready';
            else if (serviceName === 'mimir') testUrl += '/ready';
            else if (serviceName === 'minio-api') testUrl += '/minio/health/live';
            
            const response = await this.page.goto(testUrl, {
                waitUntil: 'networkidle2',
                timeout: 20000
            });
            
            const duration = Date.now() - startTime;
            const statusCode = response.status();
            const isSuccess = statusCode >= 200 && statusCode < 400;
            
            await this.addTestResult(
                serviceName,
                'API Health',
                isSuccess ? 'PASS' : 'FAIL',
                `${config.description} API responded with ${statusCode}`,
                duration,
                { statusCode, url: testUrl, responseTime: duration }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(serviceName, 'API Health', 'FAIL', `Error: ${error.message}`, duration);
            return false;
        }
    }

    async testWebSocketService(serviceName, config) {
        console.log(`🧪 Testing WebSocket for ${serviceName}...`);
        const startTime = Date.now();
        
        try {
            const wsTestResult = await this.page.evaluate(async (url) => {
                return new Promise((resolve) => {
                    try {
                        const ws = new WebSocket(url);
                        const timeout = setTimeout(() => {
                            ws.close();
                            resolve({ success: false, error: 'Connection timeout' });
                        }, 10000);

                        ws.onopen = () => {
                            clearTimeout(timeout);
                            ws.close();
                            resolve({ success: true, message: 'WebSocket connection successful' });
                        };

                        ws.onerror = (error) => {
                            clearTimeout(timeout);
                            resolve({ success: false, error: 'WebSocket connection failed' });
                        };
                    } catch (error) {
                        resolve({ success: false, error: error.message });
                    }
                });
            }, config.url);

            const duration = Date.now() - startTime;
            
            await this.addTestResult(
                serviceName,
                'WebSocket Connectivity',
                wsTestResult.success ? 'PASS' : 'FAIL',
                `${config.description}: ${wsTestResult.message || wsTestResult.error}`,
                duration,
                { webSocketTest: wsTestResult }
            );
            
            return wsTestResult.success;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(serviceName, 'WebSocket Connectivity', 'FAIL', `Error: ${error.message}`, duration);
            return false;
        }
    }

    async testService(serviceName, config) {
        console.log(`\n🔍 Testing ${serviceName} (${config.description})`);
        
        const results = [];
        
        // Always test pod health for services with namespaces
        if (config.namespace) {
            results.push(await this.testPodHealth(serviceName, config));
        }
        
        // Test based on service type
        if (config.testType === 'web_ui') {
            results.push(await this.testWebUIService(serviceName, config));
        } else if (config.testType === 'api') {
            results.push(await this.testAPIService(serviceName, config));
        } else if (config.testType === 'websocket') {
            results.push(await this.testWebSocketService(serviceName, config));
        }
        
        // Return true if at least 50% of tests passed
        const passedTests = results.filter(r => r).length;
        return passedTests >= Math.ceil(results.length / 2);
    }

    async runAllTests() {
        try {
            console.log('🎯 Starting Comprehensive Service Tests...\n');
            
            await this.setup();
            
            const serviceResults = {};
            
            // Test each service
            for (const [serviceName, config] of Object.entries(this.serviceConfigs)) {
                serviceResults[serviceName] = await this.testService(serviceName, config);
                
                // Small delay between services
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            await this.saveResults();
            
            const overallSuccess = Object.values(serviceResults).filter(r => r).length;
            const totalServices = Object.keys(serviceResults).length;
            
            console.log(`\n📊 Overall Service Health: ${overallSuccess}/${totalServices} services healthy`);
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All service tests passed!');
                return true;
            } else {
                console.log('⚠️ Some service tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during comprehensive service testing:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async saveResults() {
        this.results.summary.failed = this.results.summary.total - this.results.summary.passed;
        this.results.summary.success_rate = `${Math.round((this.results.summary.passed / this.results.summary.total) * 100)}%`;
        
        fs.writeFileSync(this.resultsFile, JSON.stringify(this.results, null, 2));
        
        console.log('\n📊 Comprehensive Service Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ComprehensiveServiceTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = ComprehensiveServiceTester;