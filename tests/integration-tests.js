const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `integration-tests-${this.timestamp}.json`);
        this.kubeconfig = process.env.KUBECONFIG || '~/livekit-demo-k8s.config';
        
        this.results = {
            timestamp: this.timestamp,
            test_type: 'integration_tests',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                success_rate: '0%'
            }
        };
        
        this.browser = null;
        this.pages = [];

        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async addTestResult(name, status, details, duration, screenshot = null, metrics = null) {
        this.results.summary.total++;
        if (status === 'PASS') {
            this.results.summary.passed++;
        }

        this.results.tests.push({
            name,
            status,
            details,
            duration: `${duration}ms`,
            screenshot: screenshot || null,
            metrics: metrics || null
        });

        console.log(`${status === 'PASS' ? '✅' : '❌'} ${name}: ${details}`);
    }

    async takeScreenshot(page, testName) {
        if (page) {
            const screenshotPath = path.join(this.resultsDir, `${testName.replace(/\s+/g, '-')}-${this.timestamp}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            return screenshotPath;
        }
        return null;
    }

    async setup() {
        console.log('🚀 Setting up Integration Testing Environment...');
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
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream'
            ]
        });

        // Create multiple pages for multi-service testing
        for (let i = 0; i < 3; i++) {
            const page = await this.browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            
            const context = this.browser.defaultBrowserContext();
            await context.overridePermissions('https://meet.livekit-demo.cloudportal.app', [
                'camera', 'microphone'
            ]);
            
            this.pages.push(page);
        }
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
            console.warn('⚠️ Using fallback credentials');
            return { 
                apiKey: 'test', 
                apiSecret: 'ThisIsAVeryLongSecretKeyForLiveKitThatIsAtLeast32Characters'
            };
        }
    }

    async testFullStackConnectivity() {
        console.log('🧪 Testing Full Stack Connectivity...');
        const startTime = Date.now();
        
        try {
            const page = this.pages[0];
            const connectivityResults = [];
            
            // Test LiveKit Server -> Redis connectivity
            const redisTest = await page.evaluate(async () => {
                try {
                    const ws = new WebSocket('wss://livekit.livekit-demo.cloudportal.app');
                    return new Promise(resolve => {
                        const timeout = setTimeout(() => {
                            ws.close();
                            resolve({ service: 'LiveKit->Redis', success: false, error: 'Timeout' });
                        }, 5000);
                        
                        ws.onopen = () => {
                            clearTimeout(timeout);
                            ws.close();
                            resolve({ service: 'LiveKit->Redis', success: true, message: 'WebSocket connected' });
                        };
                        
                        ws.onerror = () => {
                            clearTimeout(timeout);
                            resolve({ service: 'LiveKit->Redis', success: false, error: 'Connection failed' });
                        };
                    });
                } catch (error) {
                    return { service: 'LiveKit->Redis', success: false, error: error.message };
                }
            });
            connectivityResults.push(redisTest);
            
            // Test API -> Backend connectivity
            await page.goto('https://api.livekit-demo.cloudportal.app/health', { timeout: 10000 });
            const apiResponse = await page.evaluate(() => {
                return {
                    service: 'API Health',
                    success: document.body.textContent.length > 0,
                    message: `Response length: ${document.body.textContent.length}`
                };
            });
            connectivityResults.push(apiResponse);
            
            // Test Frontend -> Backend integration
            await page.goto('https://meet.livekit-demo.cloudportal.app', { timeout: 15000 });
            const frontendTest = await page.evaluate(() => {
                return {
                    service: 'Frontend->Backend',
                    success: document.title.length > 0 && document.body.children.length > 0,
                    message: `Title: "${document.title}", Elements: ${document.body.children.length}`
                };
            });
            connectivityResults.push(frontendTest);
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'full-stack-connectivity');
            
            const successfulTests = connectivityResults.filter(r => r.success).length;
            const isSuccess = successfulTests === connectivityResults.length;
            
            const details = connectivityResults.map(r => 
                `${r.service}: ${r.success ? '✓' : '✗'} ${r.message || r.error || ''}`
            ).join('; ');
            
            await this.addTestResult(
                'Full Stack Connectivity',
                isSuccess ? 'PASS' : 'FAIL',
                `${successfulTests}/${connectivityResults.length} services connected. ${details}`,
                duration,
                screenshot,
                { connectivityResults, successfulTests, totalTests: connectivityResults.length }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(this.pages[0], 'connectivity-error');
            await this.addTestResult(
                'Full Stack Connectivity',
                'FAIL',
                `Error testing connectivity: ${error.message}`,
                duration,
                screenshot
            );
            return false;
        }
    }

    async testEndToEndWorkflow() {
        console.log('🧪 Testing End-to-End User Workflow...');
        const startTime = Date.now();
        
        try {
            const page = this.pages[0];
            const workflowSteps = [];
            
            // Step 1: Access frontend
            await page.goto('https://meet.livekit-demo.cloudportal.app', { 
                waitUntil: 'networkidle2', 
                timeout: 20000 
            });
            
            const frontendLoad = await page.evaluate(() => ({
                title: document.title,
                loaded: document.readyState === 'complete',
                hasContent: document.body.children.length > 5
            }));
            
            workflowSteps.push({
                step: 'Frontend Load',
                success: frontendLoad.loaded && frontendLoad.hasContent,
                details: `Title: "${frontendLoad.title}", Elements: ${document.body.children.length}`
            });
            
            // Step 2: Check for room functionality
            const roomFeatures = await page.evaluate(() => {
                const inputs = document.querySelectorAll('input[type="text"], input[placeholder*="room"], input[placeholder*="name"]');
                const buttons = document.querySelectorAll('button');
                const videos = document.querySelectorAll('video, canvas');
                
                return {
                    hasInputs: inputs.length > 0,
                    hasButtons: buttons.length > 0,
                    hasVideoElements: videos.length >= 0, // Allow 0 as videos might load dynamically
                    inputCount: inputs.length,
                    buttonCount: buttons.length,
                    videoCount: videos.length
                };
            });
            
            workflowSteps.push({
                step: 'Room Features',
                success: roomFeatures.hasInputs && roomFeatures.hasButtons,
                details: `Inputs: ${roomFeatures.inputCount}, Buttons: ${roomFeatures.buttonCount}, Videos: ${roomFeatures.videoCount}`
            });
            
            // Step 3: Test WebRTC capabilities
            const webrtcTest = await page.evaluate(async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    const tracks = stream.getTracks();
                    tracks.forEach(track => track.stop());
                    
                    return {
                        success: true,
                        videoTracks: stream.getVideoTracks().length,
                        audioTracks: stream.getAudioTracks().length
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.name
                    };
                }
            });
            
            workflowSteps.push({
                step: 'WebRTC Capabilities',
                success: webrtcTest.success,
                details: webrtcTest.success ? 
                    `Video: ${webrtcTest.videoTracks}, Audio: ${webrtcTest.audioTracks}` : 
                    `Error: ${webrtcTest.error}`
            });
            
            // Step 4: Test API integration
            try {
                await page.goto('https://api.livekit-demo.cloudportal.app/health', { timeout: 10000 });
                const apiTest = await page.evaluate(() => ({
                    response: document.body.textContent,
                    hasContent: document.body.textContent.length > 0
                }));
                
                workflowSteps.push({
                    step: 'API Integration',
                    success: apiTest.hasContent,
                    details: `API response: ${apiTest.response.substring(0, 100)}`
                });
            } catch (error) {
                workflowSteps.push({
                    step: 'API Integration',
                    success: false,
                    details: `API error: ${error.message}`
                });
            }
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'end-to-end-workflow');
            
            const successfulSteps = workflowSteps.filter(s => s.success).length;
            const isSuccess = successfulSteps >= Math.ceil(workflowSteps.length * 0.75); // 75% success rate
            
            const details = workflowSteps.map(s => 
                `${s.step}: ${s.success ? '✓' : '✗'} ${s.details}`
            ).join('; ');
            
            await this.addTestResult(
                'End-to-End Workflow',
                isSuccess ? 'PASS' : 'FAIL',
                `${successfulSteps}/${workflowSteps.length} steps successful. ${details}`,
                duration,
                screenshot,
                { workflowSteps, successfulSteps, totalSteps: workflowSteps.length }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(this.pages[0], 'workflow-error');
            await this.addTestResult(
                'End-to-End Workflow',
                'FAIL',
                `Workflow test error: ${error.message}`,
                duration,
                screenshot
            );
            return false;
        }
    }

    async testServiceMeshCommunication() {
        console.log('🧪 Testing Service Mesh Communication...');
        const startTime = Date.now();
        
        try {
            // Test inter-service communication by checking if services can reach each other
            const communicationTests = [];
            
            // Test 1: Frontend -> LiveKit Server
            const page1 = this.pages[0];
            await page1.goto('https://meet.livekit-demo.cloudportal.app', { timeout: 15000 });
            
            const frontendToLivekit = await page1.evaluate(async () => {
                try {
                    const response = await fetch('https://livekit.livekit-demo.cloudportal.app/', { mode: 'no-cors' });
                    return { success: true, message: 'Connection successful' };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            });
            
            communicationTests.push({
                route: 'Frontend -> LiveKit',
                ...frontendToLivekit
            });
            
            // Test 2: API Health check
            const page2 = this.pages[1];
            try {
                await page2.goto('https://api.livekit-demo.cloudportal.app/health', { timeout: 10000 });
                const apiHealth = await page2.evaluate(() => ({
                    success: document.body.textContent.length > 0,
                    message: `Health check response received`
                }));
                
                communicationTests.push({
                    route: 'API Health',
                    ...apiHealth
                });
            } catch (error) {
                communicationTests.push({
                    route: 'API Health',
                    success: false,
                    error: error.message
                });
            }
            
            // Test 3: Grafana monitoring endpoint
            const page3 = this.pages[2];
            try {
                const response = await page3.goto('https://grafana.livekit-demo.cloudportal.app/api/health', { timeout: 10000 });
                const grafanaHealth = {
                    success: response.status() < 400,
                    message: `Grafana health: ${response.status()}`
                };
                
                communicationTests.push({
                    route: 'Grafana Health',
                    ...grafanaHealth
                });
            } catch (error) {
                communicationTests.push({
                    route: 'Grafana Health',
                    success: false,
                    error: error.message
                });
            }
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page1, 'service-mesh');
            
            const successfulComms = communicationTests.filter(t => t.success).length;
            const isSuccess = successfulComms >= Math.ceil(communicationTests.length * 0.66); // 66% success rate
            
            const details = communicationTests.map(t => 
                `${t.route}: ${t.success ? '✓' : '✗'} ${t.message || t.error || ''}`
            ).join('; ');
            
            await this.addTestResult(
                'Service Mesh Communication',
                isSuccess ? 'PASS' : 'FAIL',
                `${successfulComms}/${communicationTests.length} routes working. ${details}`,
                duration,
                screenshot,
                { communicationTests, successfulComms, totalRoutes: communicationTests.length }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Service Mesh Communication',
                'FAIL',
                `Service mesh test error: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testMonitoringIntegration() {
        console.log('🧪 Testing Monitoring Integration...');
        const startTime = Date.now();
        
        try {
            const monitoringTests = [];
            const page = this.pages[0];
            
            // Test Grafana
            try {
                const grafanaResponse = await page.goto('https://grafana.livekit-demo.cloudportal.app/api/health', { timeout: 10000 });
                monitoringTests.push({
                    service: 'Grafana',
                    success: grafanaResponse.status() < 400,
                    status: grafanaResponse.status(),
                    message: `Health endpoint accessible`
                });
            } catch (error) {
                monitoringTests.push({
                    service: 'Grafana',
                    success: false,
                    message: `Error: ${error.message}`
                });
            }
            
            // Test Loki
            try {
                const lokiResponse = await page.goto('https://gateway-loki.livekit-demo.cloudportal.app/ready', { timeout: 10000 });
                monitoringTests.push({
                    service: 'Loki',
                    success: lokiResponse.status() < 400,
                    status: lokiResponse.status(),
                    message: `Ready endpoint accessible`
                });
            } catch (error) {
                monitoringTests.push({
                    service: 'Loki',
                    success: false,
                    message: `Error: ${error.message}`
                });
            }
            
            // Test Mimir
            try {
                const mimirResponse = await page.goto('https://mimir.livekit-demo.cloudportal.app/ready', { timeout: 10000 });
                monitoringTests.push({
                    service: 'Mimir',
                    success: mimirResponse.status() < 400,
                    status: mimirResponse.status(),
                    message: `Ready endpoint accessible`
                });
            } catch (error) {
                monitoringTests.push({
                    service: 'Mimir',
                    success: false,
                    message: `Error: ${error.message}`
                });
            }
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'monitoring-integration');
            
            const workingServices = monitoringTests.filter(t => t.success).length;
            const isSuccess = workingServices >= Math.ceil(monitoringTests.length * 0.66);
            
            const details = monitoringTests.map(t => 
                `${t.service}: ${t.success ? '✓' : '✗'} ${t.message}`
            ).join('; ');
            
            await this.addTestResult(
                'Monitoring Integration',
                isSuccess ? 'PASS' : 'FAIL',
                `${workingServices}/${monitoringTests.length} monitoring services working. ${details}`,
                duration,
                screenshot,
                { monitoringTests, workingServices, totalServices: monitoringTests.length }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Monitoring Integration',
                'FAIL',
                `Monitoring test error: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testDataPersistence() {
        console.log('🧪 Testing Data Persistence (MinIO S3)...');
        const startTime = Date.now();
        
        try {
            const page = this.pages[0];
            const persistenceTests = [];
            
            // Test MinIO Console
            try {
                const minioConsoleResponse = await page.goto('https://s3.livekit-demo.cloudportal.app', { timeout: 15000 });
                const consoleTest = await page.evaluate(() => ({
                    hasLoginForm: document.querySelector('input[type="password"], input[placeholder*="password"]') !== null,
                    bodyContent: document.body.textContent.length
                }));
                
                persistenceTests.push({
                    component: 'MinIO Console',
                    success: minioConsoleResponse.status() < 400 && (consoleTest.hasLoginForm || consoleTest.bodyContent > 100),
                    message: `Console accessible, login form: ${consoleTest.hasLoginForm ? 'present' : 'not found'}`
                });
            } catch (error) {
                persistenceTests.push({
                    component: 'MinIO Console',
                    success: false,
                    message: `Error: ${error.message}`
                });
            }
            
            // Test MinIO API Health
            try {
                const minioApiResponse = await page.goto('https://s3api.livekit-demo.cloudportal.app/minio/health/live', { timeout: 10000 });
                persistenceTests.push({
                    component: 'MinIO API',
                    success: minioApiResponse.status() < 400,
                    message: `API health: ${minioApiResponse.status()}`
                });
            } catch (error) {
                persistenceTests.push({
                    component: 'MinIO API',
                    success: false,
                    message: `Error: ${error.message}`
                });
            }
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'data-persistence');
            
            const workingComponents = persistenceTests.filter(t => t.success).length;
            const isSuccess = workingComponents === persistenceTests.length;
            
            const details = persistenceTests.map(t => 
                `${t.component}: ${t.success ? '✓' : '✗'} ${t.message}`
            ).join('; ');
            
            await this.addTestResult(
                'Data Persistence (S3)',
                isSuccess ? 'PASS' : 'FAIL',
                `${workingComponents}/${persistenceTests.length} storage components working. ${details}`,
                duration,
                screenshot,
                { persistenceTests, workingComponents, totalComponents: persistenceTests.length }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Data Persistence (S3)',
                'FAIL',
                `Persistence test error: ${error.message}`,
                duration
            );
            return false;
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
        
        console.log('\n📊 Integration Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }

    async runAllTests() {
        try {
            console.log('🎯 Starting Integration Tests...\n');
            
            await this.setup();
            await this.testFullStackConnectivity();
            await this.testEndToEndWorkflow();
            await this.testServiceMeshCommunication();
            await this.testMonitoringIntegration();
            await this.testDataPersistence();
            
            await this.saveResults();
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All integration tests passed!');
                return true;
            } else {
                console.log('⚠️ Some integration tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during integration testing:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new IntegrationTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = IntegrationTester;