const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class ArgoCDAppsTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `argocd-apps-tests-${this.timestamp}.json`);
        this.kubeconfig = process.env.KUBECONFIG || '~/livekit-demo-k8s.config';
        
        this.results = {
            timestamp: this.timestamp,
            test_type: 'argocd_applications_tests',
            tests: [],
            applications: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                success_rate: '0%'
            }
        };
        
        this.browser = null;
        this.page = null;

        // Application test configurations
        this.appConfigs = {
            'argocd': {
                url: 'https://argocd.livekit-demo.cloudportal.app',
                namespace: 'argocd',
                healthEndpoint: '/api/version',
                testType: 'web_ui',
                loginRequired: true,
                expectedElements: ['input[type="password"]', 'button[type="submit"]'],
                description: 'GitOps deployment management'
            },
            'grafana': {
                url: 'https://grafana.livekit-demo.cloudportal.app',
                namespace: 'grafana',
                healthEndpoint: '/api/health',
                testType: 'web_ui',
                loginRequired: true,
                expectedElements: ['input[name="user"]', 'input[name="password"]'],
                description: 'Monitoring and visualization'
            },
            'harbor': {
                url: 'https://repo.livekit-demo.cloudportal.app',
                namespace: 'harbor',
                healthEndpoint: '/api/v2.0/health',
                testType: 'web_ui',
                loginRequired: true,
                expectedElements: ['input[placeholder*="username"], input[placeholder*="Username"]'],
                description: 'Container registry'
            },
            'livekit': {
                url: 'https://livekit.livekit-demo.cloudportal.app',
                namespace: 'livekit',
                healthEndpoint: '/',
                testType: 'websocket',
                loginRequired: false,
                description: 'LiveKit WebRTC server'
            },
            'meet-client': {
                url: 'https://meet.livekit-demo.cloudportal.app',
                namespace: 'meet-client',
                healthEndpoint: '/',
                testType: 'web_ui',
                loginRequired: false,
                expectedElements: ['body', 'script'],
                description: 'Video conferencing frontend'
            },
            'loki': {
                url: 'https://gateway-loki.livekit-demo.cloudportal.app',
                namespace: 'loki',
                healthEndpoint: '/ready',
                testType: 'api',
                loginRequired: false,
                description: 'Log aggregation system'
            },
            'mimir': {
                url: 'https://mimir.livekit-demo.cloudportal.app',
                namespace: 'mimir',
                healthEndpoint: '/ready',
                testType: 'api',
                loginRequired: false,
                description: 'Metrics storage system'
            },
            'minio-console': {
                url: 'https://s3.livekit-demo.cloudportal.app',
                namespace: 'minio-tenant',
                healthEndpoint: '/minio/health/live',
                testType: 'web_ui',
                loginRequired: true,
                expectedElements: ['input[placeholder*="Username"], input[placeholder*="username"]'],
                description: 'MinIO S3 console'
            },
            'minio-api': {
                url: 'https://s3api.livekit-demo.cloudportal.app',
                namespace: 'minio-tenant',
                healthEndpoint: '/minio/health/live',
                testType: 'api',
                loginRequired: false,
                description: 'MinIO S3 API'
            },
            'minio-operator': {
                url: 'https://minio-operator.livekit-demo.cloudportal.app',
                namespace: 'minio-operator',
                healthEndpoint: '/',
                testType: 'web_ui',
                loginRequired: false,
                expectedElements: ['body'],
                description: 'MinIO operator interface'
            },
            'trivoh-api': {
                url: 'https://api.livekit-demo.cloudportal.app',
                namespace: 'trivoh-api',
                healthEndpoint: '/health',
                testType: 'api',
                loginRequired: false,
                description: 'Backend API service'
            },
            'trivoh-frontend': {
                url: 'https://trivoh.livekit-demo.cloudportal.app',
                namespace: 'trivoh',
                healthEndpoint: '/',
                testType: 'web_ui',
                loginRequired: false,
                expectedElements: ['body', 'script'],
                description: 'Trivoh frontend application'
            },
            'livekit-ingress': {
                url: 'https://ingress.livekit-demo.cloudportal.app',
                namespace: 'livekit',
                healthEndpoint: '/health',
                testType: 'api',
                loginRequired: false,
                description: 'LiveKit RTMP/WHIP ingress service'
            },
            'livekit-egress': {
                url: 'https://livekit.livekit-demo.cloudportal.app',
                namespace: 'livekit',
                healthEndpoint: '/health',
                testType: 'api',
                loginRequired: false,
                description: 'LiveKit recording and streaming egress'
            },
            'redis': {
                url: 'redis://redis-redis-cluster.redis.svc.cluster.local:6379',
                namespace: 'redis',
                healthEndpoint: '/ping',
                testType: 'internal',
                loginRequired: false,
                description: 'Redis cluster for distributed state'
            },
            'cert-manager': {
                url: 'https://livekit-demo.cloudportal.app',
                namespace: 'cert-manager',
                healthEndpoint: '/',
                testType: 'internal',
                loginRequired: false,
                description: 'Certificate management system'
            },
            'external-secrets': {
                url: 'https://livekit-demo.cloudportal.app',
                namespace: 'external-secrets-system',
                healthEndpoint: '/',
                testType: 'internal',
                loginRequired: false,
                description: 'External secrets operator'
            }
        };

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

    async takeScreenshot(testName) {
        if (this.page) {
            const screenshotPath = path.join(this.resultsDir, `${testName.replace(/\s+/g, '-')}-${this.timestamp}.png`);
            await this.page.screenshot({ path: screenshotPath, fullPage: true });
            return screenshotPath;
        }
        return null;
    }

    async setup() {
        console.log('🚀 Setting up Puppeteer for ArgoCD apps testing...');
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
        
        // Set user agent
        await this.page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async getArgoCDApplications() {
        console.log('📋 Discovering ArgoCD applications...');
        try {
            const appsOutput = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get applications -n argocd -o json`,
                { encoding: 'utf8', timeout: 30000 }
            );
            
            const appsData = JSON.parse(appsOutput);
            const applications = {};
            
            appsData.items.forEach(app => {
                const name = app.metadata.name;
                applications[name] = {
                    name,
                    namespace: app.spec.destination?.namespace || 'default',
                    syncStatus: app.status?.sync?.status || 'Unknown',
                    healthStatus: app.status?.health?.status || 'Unknown',
                    source: app.spec.source?.path || app.spec.source?.chart || 'Unknown'
                };
            });
            
            this.results.applications = applications;
            console.log(`Found ${Object.keys(applications).length} ArgoCD applications`);
            return applications;
        } catch (error) {
            console.warn('⚠️ Could not fetch ArgoCD applications:', error.message);
            return {};
        }
    }

    async testArgoCDApplicationStatus() {
        console.log('🧪 Testing ArgoCD Application Status...');
        const startTime = Date.now();
        
        try {
            const applications = await this.getArgoCDApplications();
            const appCount = Object.keys(applications).length;
            
            if (appCount === 0) {
                const duration = Date.now() - startTime;
                await this.addTestResult(
                    'ArgoCD Applications Discovery',
                    'FAIL',
                    'No ArgoCD applications found',
                    duration
                );
                return false;
            }
            
            let healthyApps = 0;
            let syncedApps = 0;
            const appStatuses = [];
            
            Object.values(applications).forEach(app => {
                if (app.healthStatus === 'Healthy') healthyApps++;
                if (app.syncStatus === 'Synced') syncedApps++;
                appStatuses.push(`${app.name}: ${app.healthStatus}/${app.syncStatus}`);
            });
            
            const duration = Date.now() - startTime;
            const healthRate = Math.round((healthyApps / appCount) * 100);
            const syncRate = Math.round((syncedApps / appCount) * 100);
            
            const status = (healthRate >= 80 && syncRate >= 80) ? 'PASS' : 'FAIL';
            
            await this.addTestResult(
                'ArgoCD Applications Status',
                status,
                `${healthyApps}/${appCount} healthy (${healthRate}%), ${syncedApps}/${appCount} synced (${syncRate}%)`,
                duration,
                null,
                { healthyApps, syncedApps, totalApps: appCount, healthRate, syncRate }
            );
            
            return status === 'PASS';
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'ArgoCD Applications Status',
                'FAIL',
                `Error checking applications: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testKubernetesPods() {
        console.log('🧪 Testing Kubernetes Pods for All Applications...');
        const startTime = Date.now();
        
        try {
            const namespaces = ['argocd', 'grafana', 'harbor', 'livekit', 'meet-client', 'trivoh', 'loki', 'mimir', 'minio-operator', 'minio-tenant', 'trivoh-api', 'redis', 'cert-manager', 'ingress-nginx', 'external-secrets-system'];
            const podStatuses = {};
            let totalPods = 0;
            let runningPods = 0;
            
            for (const namespace of namespaces) {
                try {
                    const podsOutput = execSync(
                        `KUBECONFIG=${this.kubeconfig} kubectl get pods -n ${namespace} --no-headers 2>/dev/null || echo "namespace-not-found"`,
                        { encoding: 'utf8', timeout: 10000 }
                    );
                    
                    if (podsOutput.trim() === 'namespace-not-found' || !podsOutput.trim()) {
                        podStatuses[namespace] = { running: 0, total: 0, status: 'No pods or namespace not found' };
                        continue;
                    }
                    
                    const pods = podsOutput.trim().split('\n');
                    const running = pods.filter(pod => pod.includes('Running') || pod.includes('Completed')).length;
                    
                    podStatuses[namespace] = { running, total: pods.length, status: `${running}/${pods.length} running` };
                    totalPods += pods.length;
                    runningPods += running;
                } catch (error) {
                    podStatuses[namespace] = { running: 0, total: 0, status: `Error: ${error.message}` };
                }
            }
            
            const duration = Date.now() - startTime;
            const healthRate = totalPods > 0 ? Math.round((runningPods / totalPods) * 100) : 0;
            const status = healthRate >= 90 ? 'PASS' : 'FAIL';
            
            const details = Object.entries(podStatuses)
                .map(([ns, data]) => `${ns}: ${data.status}`)
                .join(', ');
            
            await this.addTestResult(
                'Kubernetes Pods Health',
                status,
                `${runningPods}/${totalPods} pods running (${healthRate}%). ${details}`,
                duration,
                null,
                { podStatuses, runningPods, totalPods, healthRate }
            );
            
            return status === 'PASS';
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Kubernetes Pods Health',
                'FAIL',
                `Error checking pods: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testApplicationEndpoint(appName, config) {
        console.log(`🧪 Testing ${appName} (${config.description})...`);
        const startTime = Date.now();
        
        try {
            if (config.testType === 'internal') {
                return await this.testInternalService(appName, config, startTime);
            } else if (config.testType === 'api') {
                return await this.testAPIEndpoint(appName, config, startTime);
            } else if (config.testType === 'websocket') {
                return await this.testWebSocketEndpoint(appName, config, startTime);
            } else {
                return await this.testWebUIEndpoint(appName, config, startTime);
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(`${appName}-error`);
            await this.addTestResult(
                `${appName} Application Test`,
                'FAIL',
                `Error testing ${appName}: ${error.message}`,
                duration,
                screenshot
            );
            return false;
        }
    }

    async testInternalService(appName, config, startTime) {
        // For internal services, we test by checking if their pods are running
        try {
            const podsOutput = execSync(
                `KUBECONFIG=${this.kubeconfig} kubectl get pods -n ${config.namespace} --no-headers 2>/dev/null || echo "namespace-not-found"`,
                { encoding: 'utf8', timeout: 10000 }
            );
            
            const duration = Date.now() - startTime;
            
            if (podsOutput.trim() === 'namespace-not-found' || !podsOutput.trim()) {
                await this.addTestResult(
                    `${appName} Internal Service Test`,
                    'FAIL',
                    `${config.description}: Namespace not found or no pods`,
                    duration
                );
                return false;
            }
            
            const pods = podsOutput.trim().split('\n');
            const runningPods = pods.filter(pod => pod.includes('Running') || pod.includes('Completed')).length;
            const totalPods = pods.length;
            
            const isHealthy = runningPods > 0 && (runningPods / totalPods) >= 0.8;
            
            await this.addTestResult(
                `${appName} Internal Service Test`,
                isHealthy ? 'PASS' : 'FAIL',
                `${config.description}: ${runningPods}/${totalPods} pods running`,
                duration,
                null,
                { runningPods, totalPods, namespace: config.namespace }
            );
            
            return isHealthy;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                `${appName} Internal Service Test`,
                'FAIL',
                `Internal service test failed: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testAPIEndpoint(appName, config, startTime) {
        const testUrl = config.url + config.healthEndpoint;
        
        try {
            const response = await this.page.goto(testUrl, {
                waitUntil: 'networkidle2',
                timeout: 20000
            });
            
            const duration = Date.now() - startTime;
            const statusCode = response.status();
            
            // API endpoints might return various success codes
            const isSuccess = statusCode >= 200 && statusCode < 400;
            
            await this.addTestResult(
                `${appName} API Endpoint`,
                isSuccess ? 'PASS' : 'FAIL',
                `${config.description} API responded with ${statusCode}`,
                duration,
                null,
                { statusCode, url: testUrl, responseTime: duration }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                `${appName} API Endpoint`,
                'FAIL',
                `API test failed: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testWebSocketEndpoint(appName, config, startTime) {
        try {
            const wsTestResult = await this.page.evaluate(async (url) => {
                return new Promise((resolve) => {
                    try {
                        const ws = new WebSocket(url.replace('https://', 'wss://'));
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
                `${appName} WebSocket Test`,
                wsTestResult.success ? 'PASS' : 'FAIL',
                `${config.description}: ${wsTestResult.message || wsTestResult.error}`,
                duration,
                null,
                { webSocketTest: wsTestResult }
            );
            
            return wsTestResult.success;
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                `${appName} WebSocket Test`,
                'FAIL',
                `WebSocket test error: ${error.message}`,
                duration
            );
            return false;
        }
    }

    async testWebUIEndpoint(appName, config, startTime) {
        try {
            const response = await this.page.goto(config.url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            const statusCode = response.status();
            let elementCheck = { found: 0, total: 0, details: [] };
            
            // Check for expected elements if specified
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
                // Basic check for any content
                const bodyText = await this.page.evaluate(() => document.body.textContent.length);
                elementCheck = { 
                    found: bodyText > 100 ? 1 : 0, 
                    total: 1, 
                    details: [`Page content: ${bodyText > 100 ? 'Present' : 'Minimal'} (${bodyText} chars)`] 
                };
            }
            
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(`${appName}-ui`);
            
            const isSuccess = statusCode < 400 && (elementCheck.found >= Math.ceil(elementCheck.total / 2));
            
            await this.addTestResult(
                `${appName} Web UI Test`,
                isSuccess ? 'PASS' : 'FAIL',
                `${config.description} (${statusCode}): ${elementCheck.details.join(', ')}`,
                duration,
                screenshot,
                { statusCode, elementCheck, responseTime: duration }
            );
            
            return isSuccess;
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(`${appName}-ui-error`);
            await this.addTestResult(
                `${appName} Web UI Test`,
                'FAIL',
                `UI test failed: ${error.message}`,
                duration,
                screenshot
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
        
        console.log('\n📊 ArgoCD Applications Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }

    async runAllTests() {
        try {
            console.log('🎯 Starting ArgoCD Applications Tests...\n');
            
            await this.setup();
            
            // Test ArgoCD application status
            await this.testArgoCDApplicationStatus();
            
            // Test Kubernetes pods
            await this.testKubernetesPods();
            
            // Test each application endpoint
            for (const [appName, config] of Object.entries(this.appConfigs)) {
                await this.testApplicationEndpoint(appName, config);
                
                // Small delay between tests
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            
            await this.saveResults();
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All ArgoCD application tests passed!');
                return true;
            } else {
                console.log('⚠️ Some ArgoCD application tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during ArgoCD apps testing:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ArgoCDAppsTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = ArgoCDAppsTester;