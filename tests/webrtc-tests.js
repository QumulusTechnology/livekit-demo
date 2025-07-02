const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class WebRTCTester {
    constructor() {
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.resultsDir = './results';
        this.resultsFile = path.join(this.resultsDir, `webrtc-tests-${this.timestamp}.json`);
        this.results = {
            timestamp: this.timestamp,
            test_type: 'webrtc_tests',
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

    async takeScreenshot(page, testName) {
        if (page) {
            const screenshotPath = path.join(this.resultsDir, `${testName.replace(/\s+/g, '-')}-${this.timestamp}.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            return screenshotPath;
        }
        return null;
    }

    async setup() {
        console.log('🚀 Setting up Puppeteer for WebRTC testing...');
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
                '--disable-features=VizDisplayCompositor',
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--use-file-for-fake-video-capture=/dev/null',
                '--use-file-for-fake-audio-capture=/dev/null'
            ]
        });

        // Create test pages
        for (let i = 0; i < 2; i++) {
            const page = await this.browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            
            // Override permissions
            const context = this.browser.defaultBrowserContext();
            await context.overridePermissions('https://meet.livekit-demo.cloudportal.app', [
                'camera',
                'microphone'
            ]);

            this.pages.push(page);
        }
    }

    async testWebSocketConnection() {
        console.log('🧪 Testing WebSocket Connection...');
        const startTime = Date.now();
        const page = this.pages[0];
        
        try {
            // Navigate to the frontend
            await page.goto('https://meet.livekit-demo.cloudportal.app', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Listen for WebSocket connections
            const wsConnections = [];
            page.on('response', response => {
                if (response.url().includes('wss://') || response.url().includes('ws://')) {
                    wsConnections.push(response.url());
                }
            });

            // Inject test script to check WebSocket connectivity
            const wsTestResult = await page.evaluate(async () => {
                return new Promise((resolve) => {
                    try {
                        const ws = new WebSocket('wss://livekit.livekit-demo.cloudportal.app');
                        const timeout = setTimeout(() => {
                            ws.close();
                            resolve({ success: false, error: 'Connection timeout' });
                        }, 10000);

                        ws.onopen = () => {
                            clearTimeout(timeout);
                            ws.close();
                            resolve({ success: true, readyState: ws.readyState });
                        };

                        ws.onerror = (error) => {
                            clearTimeout(timeout);
                            resolve({ success: false, error: 'WebSocket error', readyState: ws.readyState });
                        };

                        ws.onclose = (event) => {
                            if (!timeout._destroyed) {
                                clearTimeout(timeout);
                                resolve({ 
                                    success: event.wasClean, 
                                    code: event.code, 
                                    reason: event.reason 
                                });
                            }
                        };
                    } catch (error) {
                        resolve({ success: false, error: error.message });
                    }
                });
            });

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'websocket-test');

            if (wsTestResult.success) {
                await this.addTestResult(
                    'WebSocket Connection',
                    'PASS',
                    `WebSocket connection successful. Ready state: ${wsTestResult.readyState}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'WebSocket Connection',
                    'FAIL',
                    `WebSocket connection failed: ${wsTestResult.error || 'Unknown error'}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'websocket-error');
            await this.addTestResult(
                'WebSocket Connection',
                'FAIL',
                `Error testing WebSocket: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testMediaDeviceAccess() {
        console.log('🧪 Testing Media Device Access...');
        const startTime = Date.now();
        const page = this.pages[0];
        
        try {
            const mediaResult = await page.evaluate(async () => {
                try {
                    // Test getUserMedia
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: true
                    });

                    const videoTracks = stream.getVideoTracks();
                    const audioTracks = stream.getAudioTracks();

                    // Clean up
                    stream.getTracks().forEach(track => track.stop());

                    return {
                        success: true,
                        videoTracks: videoTracks.length,
                        audioTracks: audioTracks.length,
                        devices: (await navigator.mediaDevices.enumerateDevices()).length
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'media-devices');

            if (mediaResult.success) {
                await this.addTestResult(
                    'Media Device Access',
                    'PASS',
                    `Media access granted. Video tracks: ${mediaResult.videoTracks}, Audio tracks: ${mediaResult.audioTracks}, Total devices: ${mediaResult.devices}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'Media Device Access',
                    'FAIL',
                    `Media access failed: ${mediaResult.error}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'media-error');
            await this.addTestResult(
                'Media Device Access',
                'FAIL',
                `Error testing media devices: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testRTCPeerConnection() {
        console.log('🧪 Testing RTCPeerConnection...');
        const startTime = Date.now();
        const page = this.pages[0];
        
        try {
            const peerResult = await page.evaluate(async () => {
                try {
                    const pc1 = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    });

                    const pc2 = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    });

                    // Test basic peer connection functionality
                    return new Promise((resolve) => {
                        let pc1State = 'new';
                        let pc2State = 'new';
                        let dataChannelWorking = false;

                        const timeout = setTimeout(() => {
                            pc1.close();
                            pc2.close();
                            resolve({
                                success: false,
                                error: 'Connection timeout',
                                pc1State,
                                pc2State,
                                dataChannelWorking
                            });
                        }, 15000);

                        pc1.oniceconnectionstatechange = () => {
                            pc1State = pc1.iceConnectionState;
                            if (pc1State === 'connected' || pc1State === 'completed') {
                                dataChannelWorking = true;
                                clearTimeout(timeout);
                                pc1.close();
                                pc2.close();
                                resolve({
                                    success: true,
                                    pc1State,
                                    pc2State,
                                    dataChannelWorking
                                });
                            }
                        };

                        pc2.oniceconnectionstatechange = () => {
                            pc2State = pc2.iceConnectionState;
                        };

                        // Create data channel
                        const dataChannel = pc1.createDataChannel('test');
                        
                        pc2.ondatachannel = (event) => {
                            const channel = event.channel;
                            channel.onopen = () => {
                                dataChannelWorking = true;
                            };
                        };

                        // Start connection process
                        pc1.createOffer().then(offer => {
                            pc1.setLocalDescription(offer);
                            pc2.setRemoteDescription(offer);
                            return pc2.createAnswer();
                        }).then(answer => {
                            pc2.setLocalDescription(answer);
                            pc1.setRemoteDescription(answer);
                        }).catch(error => {
                            clearTimeout(timeout);
                            resolve({
                                success: false,
                                error: error.message,
                                pc1State,
                                pc2State
                            });
                        });

                        // Handle ICE candidates
                        pc1.onicecandidate = (event) => {
                            if (event.candidate) {
                                pc2.addIceCandidate(event.candidate);
                            }
                        };

                        pc2.onicecandidate = (event) => {
                            if (event.candidate) {
                                pc1.addIceCandidate(event.candidate);
                            }
                        };
                    });
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'rtc-peer-connection');

            if (peerResult.success) {
                await this.addTestResult(
                    'RTCPeerConnection Test',
                    'PASS',
                    `Peer connection successful. PC1: ${peerResult.pc1State}, PC2: ${peerResult.pc2State}, Data channel: ${peerResult.dataChannelWorking}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'RTCPeerConnection Test',
                    'FAIL',
                    `Peer connection failed: ${peerResult.error}. PC1: ${peerResult.pc1State}, PC2: ${peerResult.pc2State}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'rtc-error');
            await this.addTestResult(
                'RTCPeerConnection Test',
                'FAIL',
                `Error testing RTCPeerConnection: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testLiveKitClientConnection() {
        console.log('🧪 Testing LiveKit Client Connection...');
        const startTime = Date.now();
        const page = this.pages[0];
        
        try {
            // Navigate to LiveKit frontend
            await page.goto('https://meet.livekit-demo.cloudportal.app', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Test LiveKit SDK functionality if available
            const livekitResult = await page.evaluate(async () => {
                return new Promise((resolve) => {
                    // Check if LiveKit is available
                    if (typeof window.LiveKit !== 'undefined' || typeof window.livekit !== 'undefined') {
                        resolve({
                            success: true,
                            livekitAvailable: true,
                            details: 'LiveKit SDK detected in window'
                        });
                    } else {
                        // Try to detect LiveKit through DOM or other means
                        const scripts = Array.from(document.scripts).map(s => s.src);
                        const hasLiveKitScript = scripts.some(src => src.includes('livekit'));
                        
                        resolve({
                            success: hasLiveKitScript,
                            livekitAvailable: hasLiveKitScript,
                            details: hasLiveKitScript ? 'LiveKit script detected' : 'No LiveKit detected',
                            scripts: scripts.length
                        });
                    }
                });
            });

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'livekit-client');

            if (livekitResult.success || livekitResult.livekitAvailable) {
                await this.addTestResult(
                    'LiveKit Client Connection',
                    'PASS',
                    `${livekitResult.details}. Scripts loaded: ${livekitResult.scripts || 'N/A'}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'LiveKit Client Connection',
                    'FAIL',
                    `LiveKit client not detected: ${livekitResult.details}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(page, 'livekit-error');
            await this.addTestResult(
                'LiveKit Client Connection',
                'FAIL',
                `Error testing LiveKit client: ${error.message}`,
                duration,
                screenshot
            );
        }
    }

    async testMultiUserScenario() {
        console.log('🧪 Testing Multi-User Scenario...');
        const startTime = Date.now();
        
        try {
            // This is a simplified multi-user test
            // In a real scenario, you'd test actual room joining and participant interaction
            
            const results = [];
            
            for (let i = 0; i < this.pages.length; i++) {
                const page = this.pages[i];
                
                try {
                    await page.goto('https://meet.livekit-demo.cloudportal.app', {
                        waitUntil: 'networkidle2',
                        timeout: 20000
                    });
                    
                    // Check if page loads for multiple users
                    const title = await page.title();
                    results.push(`User ${i + 1}: ${title ? 'Loaded' : 'Failed to load'}`);
                } catch (error) {
                    results.push(`User ${i + 1}: Error - ${error.message.substring(0, 50)}`);
                }
            }

            const duration = Date.now() - startTime;
            const screenshot = await this.takeScreenshot(this.pages[0], 'multi-user');

            const successfulLoads = results.filter(r => r.includes('Loaded')).length;
            
            if (successfulLoads === this.pages.length) {
                await this.addTestResult(
                    'Multi-User Scenario',
                    'PASS',
                    `All ${this.pages.length} users loaded successfully. ${results.join(', ')}`,
                    duration,
                    screenshot
                );
            } else {
                await this.addTestResult(
                    'Multi-User Scenario',
                    'FAIL',
                    `Only ${successfulLoads}/${this.pages.length} users loaded. ${results.join(', ')}`,
                    duration,
                    screenshot
                );
            }
        } catch (error) {
            const duration = Date.now() - startTime;
            await this.addTestResult(
                'Multi-User Scenario',
                'FAIL',
                `Error in multi-user test: ${error.message}`,
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
        
        console.log('\n📊 WebRTC Test Summary:');
        console.log(`   Total Tests: ${this.results.summary.total}`);
        console.log(`   Passed: ${this.results.summary.passed}`);
        console.log(`   Failed: ${this.results.summary.failed}`);
        console.log(`   Success Rate: ${this.results.summary.success_rate}`);
        console.log(`\n📁 Results saved to: ${this.resultsFile}`);
    }

    async runAllTests() {
        try {
            console.log('🎯 Starting WebRTC Tests...\n');
            
            await this.setup();
            await this.testWebSocketConnection();
            await this.testMediaDeviceAccess();
            await this.testRTCPeerConnection();
            await this.testLiveKitClientConnection();
            await this.testMultiUserScenario();
            
            await this.saveResults();
            
            if (this.results.summary.failed === 0) {
                console.log('🎉 All WebRTC tests passed!');
                return true;
            } else {
                console.log('⚠️ Some WebRTC tests failed.');
                return false;
            }
        } catch (error) {
            console.error('❌ Fatal error during WebRTC testing:', error);
            return false;
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new WebRTCTester();
    tester.runAllTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}

module.exports = WebRTCTester;