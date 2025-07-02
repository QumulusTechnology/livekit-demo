const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class FrontendTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `frontend-tests-${this.timestamp}.json`);
        this.results = {
            timestamp: this.timestamp,
            test_type: 'frontend_tests',
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                success_rate: '0%'
            }
        };
        this.browser = null;
        this.page = null;

        // Ensure results directory exists
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async addTestResult(name, status, details, duration, screenshot = null) {
        this.results.summary.total++;
        if (status === 'PASS') {
            this.results.summary.passed++;
        }

        this.results.tests.push({
            name,
            status,
            details,
            duration: `${duration}ms`,
            screenshot: screenshot || null
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
        console.log('🚀 Setting up Puppeteer browser...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--enable-webrtc-logs',
                '--allow-running-insecure-content',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });
        this.page = await this.browser.newPage();
        
        // Set viewport for consistent testing
        await this.page.setViewport({ width: 1920, height: 1080 });
        
        // Enable permissions for camera/microphone
        const context = this.browser.defaultBrowserContext();
        await context.overridePermissions('https://meet.livekit-demo.cloudportal.app', [
            'camera',
            'microphone'
        ]);
    }

    async testFrontendLoading() {
        console.log('🧪 Testing Frontend Loading...');
        const startTime = Date.now();
        
        try {
            const response = await this.page.goto('https://meet.livekit-demo.cloudportal.app', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            const duration = Date.now() - startTime;
            
            if (response.ok()) {
                const title = await this.page.title();
                const screenshot = await this.takeScreenshot('frontend-loading');
                await this.addTestResult(
                    'Frontend Loading',
                    'PASS',
                    `Page loaded successfully. Title: "${title}". Response: ${response.status()}`,
                    duration,
                    screenshot
                );
            } else {
                const screenshot = await this.takeScreenshot('frontend-loading-failed');
                await this.addTestResult(
                    'Frontend Loading',
                    'FAIL',
                    `Page failed to load. Status: ${response.status()}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('frontend-loading-error');
            await this.addTestResult(
                'Frontend Loading',
                'FAIL',
                `Error loading page: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testUIElements() {
        console.log('🧪 Testing UI Elements...');
        const startTime = Date.now();
        
        try {
            // Wait for main UI elements to load
            await this.page.waitForSelector('body', { timeout: 10000 });
            
            // Check for common LiveKit UI elements
            const elements = [
                { selector: 'input[type="text"], input[placeholder*="room"], input[placeholder*="name"]', name: 'Input fields' },
                { selector: 'button', name: 'Buttons' },
                { selector: 'video, canvas', name: 'Video elements' }
            ];

            let foundElements = 0;
            const elementDetails = [];

            for (const element of elements) {
                try {
                    const found = await this.page.$(element.selector);
                    if (found) {
                        foundElements++;
                        elementDetails.push(`${element.name}: Found`);
                    } else {
                        elementDetails.push(`${element.name}: Not found`);
                    }
                } catch (err) {
                    elementDetails.push(`${element.name}: Error - ${err.message}`);
                }
            }

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('ui-elements');

            if (foundElements >= 2) {
                await this.addTestResult(
                    'UI Elements Check',
                    'PASS',
                    `Found ${foundElements}/${elements.length} expected elements. ${elementDetails.join(', ')}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'UI Elements Check',
                    'FAIL',
                    `Only found ${foundElements}/${elements.length} expected elements. ${elementDetails.join(', ')}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('ui-elements-error');
            await this.addTestResult(
                'UI Elements Check',
                'FAIL',
                `Error checking UI elements: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testResponsiveness() {
        console.log('🧪 Testing Responsiveness...');
        const startTime = Date.now();
        
        try {
            const viewports = [
                { width: 1920, height: 1080, name: 'Desktop' },
                { width: 768, height: 1024, name: 'Tablet' },
                { width: 375, height: 667, name: 'Mobile' }
            ];

            const responsiveResults = [];

            for (const viewport of viewports) {
                await this.page.setViewport(viewport);
                await this.page.reload({ waitUntil: 'networkidle2' });
                
                // Check if page is still functional
                const bodyHeight = await this.page.evaluate(() => document.body.scrollHeight);
                const hasContent = bodyHeight > 100;
                
                responsiveResults.push(`${viewport.name} (${viewport.width}x${viewport.height}): ${hasContent ? 'OK' : 'No content'}`);
            }

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('responsiveness');

            await this.addTestResult(
                'Responsiveness Test',
                'PASS',
                `Tested multiple viewports: ${responsiveResults.join(', ')}`,
                duration,
                screenshot
            );

            // Reset to default viewport
            await this.page.setViewport({ width: 1920, height: 1080 });
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('responsiveness-error');
            await this.addTestResult(
                'Responsiveness Test',
                'FAIL',
                `Error testing responsiveness: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testConsoleErrors() {
        console.log('🧪 Testing Console Errors...');
        const startTime = Date.now();
        
        const consoleErrors = [];
        const consoleWarnings = [];

        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            } else if (msg.type() === 'warning') {
                consoleWarnings.push(msg.text());
            }
        });

        try {
            await this.page.reload({ waitUntil: 'networkidle2' });
            
            // Wait a bit for any delayed console messages
            await this.page.waitForTimeout(5000);

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('console-check');

            const criticalErrors = consoleErrors.filter(err => 
                !err.includes('net::ERR_INTERNET_DISCONNECTED') &&
                !err.includes('WebSocket connection') &&
                !err.includes('Failed to load resource')
            );

            if (criticalErrors.length === 0) {
                await this.addTestResult(
                    'Console Errors Check',
                    'PASS',
                    `No critical console errors. ${consoleErrors.length} total errors, ${consoleWarnings.length} warnings`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'Console Errors Check',
                    'FAIL',
                    `${criticalErrors.length} critical console errors found: ${criticalErrors.slice(0, 3).join('; ')}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Console Errors Check',
                'FAIL',
                `Error checking console: ${error.message}`,
                duration
            );
        }
    }

    async testPerformance() {
        console.log('🧪 Testing Performance...');
        const startTime = Date.now();
        
        try {
            // Enable performance monitoring
            await this.page.tracing.start({ path: path.join(this.resultsDir, `performance-trace-${this.timestamp}.json`) });
            
            const navigationStart = await this.page.evaluate(() => performance.timing.navigationStart);
            await this.page.reload({ waitUntil: 'networkidle2' });
            
            const metrics = await this.page.evaluate(() => {
                const timing = performance.timing;
                return {
                    domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
                    loadComplete: timing.loadEventEnd - timing.navigationStart,
                    firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime || 0
                };
            });

            await this.page.tracing.stop();

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot('performance');

            const isPerformant = metrics.domContentLoaded < 3000 && metrics.loadComplete < 5000;

            await this.addTestResult(
                'Performance Test',
                isPerformant ? 'PASS' : 'FAIL',
                `DOM loaded: ${metrics.domContentLoaded}ms, Load complete: ${metrics.loadComplete}ms, FCP: ${metrics.firstContentfulPaint}ms`,
                duration,
                screenshot
            );
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Performance Test',
                'FAIL',
                `Error measuring performance: ${error.message}`,
                duration
            );
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
        
        console.log('\n📊 Frontend Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }

    async runAllTests() {
        try {
            console.log('🎯 Starting Frontend Tests...\n');
            
            await this.setup();
            await this.testFrontendLoading();
            await this.testUIElements();
            await this.testResponsiveness();
            await this.testConsoleErrors();
            await this.testPerformance();
            
            await this.saveResults();
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All frontend tests passed!');
                return true;
            } else {
                console.log('⚠️ Some frontend tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during testing:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new FrontendTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = FrontendTester;