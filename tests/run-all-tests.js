const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.summaryFile = path.join(this.resultsDir, `test-summary-${this.timestamp}.json`);
        this.htmlReportFile = path.join(this.resultsDir, `test-report-${this.timestamp}.html`);
        
        this.testSuite = {
            timestamp: this.timestamp,
            test_suites: [],
            overall_summary: {
                total_suites: 0,
                passed_suites: 0,
                failed_suites: 0,
                total_tests: 0,
                passed_tests: 0,
                failed_tests: 0,
                success_rate: '0%',
                execution_time: '0ms'
            }
        };

        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    async runShellTest(scriptPath, testName) {
        console.log(`🧪 Running ${testName}...`);
        const startTime = Date.now();
        
        try {
            const result = execSync(`bash ${scriptPath}`, { 
                encoding: 'utf8',
                timeout: 300000 // 5 minutes timeout
            });
            
            const duration = Date.now() - startTime;
            
            // Try to parse JSON results if available
            let testResults = null;
            const jsonFiles = fs.readdirSync(this.resultsDir)
                .filter(f => f.includes(testName.toLowerCase().replace(/\s+/g, '-')) && f.endsWith('.json'))
                .sort()
                .reverse();
            
            if (jsonFiles.length > 0) {
                const latestFile = path.join(this.resultsDir, jsonFiles[0]);
                testResults = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
            }
            
            return {
                name: testName,
                status: 'PASS',
                duration: `${duration}ms`,
                output: result.substring(0, 1000), // Limit output size
                results: testResults,
                error: null
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                name: testName,
                status: 'FAIL',
                duration: `${duration}ms`,
                output: error.stdout?.substring(0, 1000) || '',
                error: error.message.substring(0, 500),
                results: null
            };
        }
    }

    async runNodeTest(scriptPath, testName) {
        console.log(`🧪 Running ${testName}...`);
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const child = spawn('node', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 300000 // 5 minutes timeout
            });
            
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data); // Real-time output
            });
            
            child.stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data); // Real-time output
            });
            
            child.on('close', (code) => {
                const duration = Date.now() - startTime;
                
                // Try to parse JSON results
                let testResults = null;
                const jsonFiles = fs.readdirSync(this.resultsDir)
                    .filter(f => f.includes(testName.toLowerCase().replace(/\s+/g, '-')) && f.endsWith('.json'))
                    .sort()
                    .reverse();
                
                if (jsonFiles.length > 0) {
                    try {
                        const latestFile = path.join(this.resultsDir, jsonFiles[0]);
                        testResults = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
                    } catch (e) {
                        console.warn(`Could not parse results for ${testName}: ${e.message}`);
                    }
                }
                
                resolve({
                    name: testName,
                    status: code === 0 ? 'PASS' : 'FAIL',
                    duration: `${duration}ms`,
                    output: stdout.substring(0, 1000),
                    error: stderr ? stderr.substring(0, 500) : null,
                    results: testResults
                });
            });
            
            child.on('error', (error) => {
                const duration = Date.now() - startTime;
                resolve({
                    name: testName,
                    status: 'FAIL',
                    duration: `${duration}ms`,
                    output: '',
                    error: error.message,
                    results: null
                });
            });
        });
    }

    generateHtmlReport() {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LiveKit Demo Test Report - ${this.timestamp}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0 0 10px 0; font-size: 2rem; }
        .header p { margin: 0; opacity: 0.9; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; padding: 30px; }
        .stat-card { background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center; border-left: 4px solid #28a745; }
        .stat-card.failed { border-left-color: #dc3545; }
        .stat-card h3 { margin: 0 0 10px 0; color: #495057; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .stat-card .value { font-size: 2rem; font-weight: bold; color: #212529; }
        .test-suites { padding: 0 30px 30px 30px; }
        .test-suite { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .suite-header { background: #f8f9fa; padding: 20px; border-bottom: 1px solid #dee2e6; }
        .suite-header h3 { margin: 0; color: #495057; }
        .suite-meta { display: flex; gap: 20px; margin-top: 10px; font-size: 0.9rem; color: #6c757d; }
        .tests { padding: 0; }
        .test { padding: 15px 20px; border-bottom: 1px solid #f1f3f4; display: flex; justify-content: space-between; align-items: center; }
        .test:last-child { border-bottom: none; }
        .test-info h4 { margin: 0 0 5px 0; color: #212529; }
        .test-info p { margin: 0; color: #6c757d; font-size: 0.9rem; }
        .test-status { padding: 4px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .test-status.pass { background: #d4edda; color: #155724; }
        .test-status.fail { background: #f8d7da; color: #721c24; }
        .test-details { font-size: 0.8rem; color: #6c757d; margin-top: 5px; max-width: 500px; }
        .screenshots { margin-top: 10px; }
        .screenshots img { max-width: 200px; border-radius: 4px; margin-right: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 LiveKit Demo Test Report</h1>
            <p>Generated on ${new Date(this.timestamp.replace(/-/g, ':')).toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card">
                <h3>Test Suites</h3>
                <div class="value">${this.testSuite.overall_summary.passed_suites}/${this.testSuite.overall_summary.total_suites}</div>
            </div>
            <div class="stat-card">
                <h3>Total Tests</h3>
                <div class="value">${this.testSuite.overall_summary.passed_tests}/${this.testSuite.overall_summary.total_tests}</div>
            </div>
            <div class="stat-card ${this.testSuite.overall_summary.success_rate === '100%' ? '' : 'failed'}">
                <h3>Success Rate</h3>
                <div class="value">${this.testSuite.overall_summary.success_rate}</div>
            </div>
            <div class="stat-card">
                <h3>Execution Time</h3>
                <div class="value">${this.testSuite.overall_summary.execution_time}</div>
            </div>
        </div>
        
        <div class="test-suites">
            ${this.testSuite.test_suites.map(suite => `
                <div class="test-suite">
                    <div class="suite-header">
                        <h3>${suite.name}</h3>
                        <div class="suite-meta">
                            <span>Duration: ${suite.duration}</span>
                            <span>Status: ${suite.status}</span>
                            ${suite.results ? `<span>Tests: ${suite.results.summary.passed}/${suite.results.summary.total}</span>` : ''}
                        </div>
                    </div>
                    ${suite.results && suite.results.tests ? `
                        <div class="tests">
                            ${suite.results.tests.map(test => `
                                <div class="test">
                                    <div class="test-info">
                                        <h4>${test.name}</h4>
                                        <p>${test.details || 'No details available'}</p>
                                        <div class="test-details">Duration: ${test.duration}</div>
                                        ${test.screenshot ? `<div class="screenshots"><img src="${test.screenshot}" alt="Test screenshot" /></div>` : ''}
                                    </div>
                                    <div class="test-status ${test.status.toLowerCase()}">${test.status}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="tests">
                            <div class="test">
                                <div class="test-info">
                                    <h4>${suite.name} Execution</h4>
                                    <p>${suite.error || 'Test completed'}</p>
                                    <div class="test-details">${suite.output ? suite.output.substring(0, 200) + '...' : ''}</div>
                                </div>
                                <div class="test-status ${suite.status.toLowerCase()}">${suite.status}</div>
                            </div>
                        </div>
                    `}
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
        
        fs.writeFileSync(this.htmlReportFile, html);
        console.log(`📊 HTML report generated: ${this.htmlReportFile}`);
    }

    async runAllTests() {
        console.log('🎯 Starting Complete Test Suite...\n');
        const overallStartTime = Date.now();
        
        const tests = [
            { script: './health-checks.sh', name: 'Health Checks', type: 'shell' },
            { script: './argocd-apps-tests.js', name: 'ArgoCD Applications', type: 'node' },
            { script: './comprehensive-service-tests.js', name: 'Comprehensive Service Tests', type: 'node' },
            { script: './frontend-tests.js', name: 'Frontend Tests', type: 'node' },
            { script: './webrtc-tests.js', name: 'WebRTC Tests', type: 'node' },
            { script: './integration-tests.js', name: 'Integration Tests', type: 'node' },
            { script: './load-tests.js', name: 'Load Tests', type: 'node' }
        ];
        
        for (const test of tests) {
            try {
                let result;
                if (test.type === 'shell') {
                    result = await this.runShellTest(test.script, test.name);
                } else {
                    result = await this.runNodeTest(test.script, test.name);
                }
                
                this.testSuite.test_suites.push(result);
                this.testSuite.overall_summary.total_suites++;
                
                if (result.status === 'PASS') {
                    this.testSuite.overall_summary.passed_suites++;
                }
                
                // Aggregate test counts from individual results
                if (result.results && result.results.summary) {
                    this.testSuite.overall_summary.total_tests += result.results.summary.total || 0;
                    this.testSuite.overall_summary.passed_tests += result.results.summary.passed || 0;
                }
                
                console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${test.name}: ${result.status}\n`);
            } catch (error) {
                console.error(`❌ Error running ${test.name}: ${error.message}\n`);
                this.testSuite.test_suites.push({
                    name: test.name,
                    status: 'FAIL',
                    duration: '0ms',
                    error: error.message,
                    results: null
                });
                this.testSuite.overall_summary.total_suites++;
            }
        }
        
        // Calculate final summary
        const overallDuration = Date.now() - overallStartTime;
        this.testSuite.overall_summary.execution_time = `${overallDuration}ms`;
        this.testSuite.overall_summary.failed_tests = this.testSuite.overall_summary.total_tests - this.testSuite.overall_summary.passed_tests;
        
        if (this.testSuite.overall_summary.total_tests > 0) {
            this.testSuite.overall_summary.success_rate = `${Math.round((this.testSuite.overall_summary.passed_tests / this.testSuite.overall_summary.total_tests) * 100)}%`;
        }
        
        // Save results
        fs.writeFileSync(this.summaryFile, JSON.stringify(this.testSuite, null, 2));
        this.generateHtmlReport();
        
        console.log('📊 Final Test Summary:');
        console.log(`   Test Suites: ${this.testSuite.overall_summary.passed_suites}/${this.testSuite.overall_summary.total_suites} passed`);
        console.log(`   Total Tests: ${this.testSuite.overall_summary.passed_tests}/${this.testSuite.overall_summary.total_tests} passed`);
        console.log(`   Success Rate: ${this.testSuite.overall_summary.success_rate}`);
        console.log(`   Execution Time: ${this.testSuite.overall_summary.execution_time}`);
        console.log(`\n📁 Results saved to: ${this.summaryFile}`);
        console.log(`📊 HTML report: ${this.htmlReportFile}`);
        
        const allPassed = this.testSuite.overall_summary.passed_suites === this.testSuite.overall_summary.total_suites;
        console.log(allPassed ? '\n🎉 All test suites passed!' : '\n⚠️ Some test suites failed.');
        
        return allPassed;
    }
}

// Run tests if called directly
if (require.main === module) {
    const runner = new TestRunner();
    runner.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = TestRunner;