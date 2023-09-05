"use strict";

const virtualMixJuice = (function() {
	const NEW_LINE = "\r\n";
	const OK_STRING = "'OK" + NEW_LINE;
	const NG_STRING = "'NG: MixJuice-virtual" + NEW_LINE;
	const VIRTUAL_SSID = "virtual-ap";
	const APL_STRING = "'" + VIRTUAL_SSID + NEW_LINE + OK_STRING;
	const CONNECT_ERROR_STRING = NEW_LINE + "'WiFi error." + NEW_LINE;
	// IP address: in TEST-NET-1 ( https://datatracker.ietf.org/doc/html/rfc5737 )
	const CONNECT_DONE_STRING = NEW_LINE + "'WiFi connected: 192.0.2.3" + NEW_LINE;
	const NOT_CONNECTED_STRING = "'not connected." + NEW_LINE;
	const CONNECTED_STRING = "'Wi-Fi connected: " + VIRTUAL_SSID + NEW_LINE;
	// MAC address: locally administered addresses (LAA)
	const MAC_STRING = "'MAC Address: 7A:15:D5:30:37:A7" + NEW_LINE;
	const HTTP_FAIL_STRING = "'Connection failed: ";
	const HTTP_ERROR_STRING = "'ERROR: ";
	const TCP_FAIL_STRING = "'Connection failed." + NEW_LINE;

	const CONNECT_SUCCESS_TIME_MS = 3000;
	const CONNECT_ERROR_TIME_MS = 6000;
	const CONNECT_DOT_INTERVAL_MS = 500;

	let uartConnected = false;
	let networkConnected = true;
	const deviceBps = 115200;
	let sendWaitMs = 30;

	let lineBuffer = "";

	let postURL = "";
	let postBody = null
	let postContentType = "";

	const taskQueue = [];

	async function sleep(durationMs) {
		await new Promise(function(resolve, reject) {
			setTimeout(resolve, durationMs);
		});
	}

	function isOnline() {
		return networkConnected && window.navigator.onLine;
	}

	async function sendToUart(data) {
		if (data instanceof Uint8Array) {
			if (sendWaitMs <= 0) {
				tx(data);
			} else {
				for (let i = 0; i < data.length; i++) {
					tx(new Uint8Array([data[i]]));
					await sleep(sendWaitMs);
				}
			}
		} else {
			const dataStr = data.toString();
			if (sendWaitMs <= 0) {
				tx(dataStr);
			} else {
				for (let i = 0; i < dataStr.length; i++) {
					tx(new Uint8Array([dataStr.charCodeAt(i)]));
					await sleep(sendWaitMs);
				}
			}
		}
	}

	function startPost(target) {
		postURL = target;
		postBody = "";
	}

	async function performHttpRequest(target, isSecure, isPost) {
		const colonPoint = target.indexOf(":"), slashPoint = target.indexOf("/");
		const endPoint = colonPoint < 0 ?
			(slashPoint < 0 ? 0 : slashPoint) :
			(slashPoint < 0 || colonPoint < slashPoint ? colonPoint : slashPoint);
		const failString = HTTP_FAIL_STRING + target.substring(0, endPoint) + NEW_LINE;
		if (slashPoint < 0 || !networkConnected) {
			await sendToUart(failString);
			return;
		}
		const url = (isSecure ? "https" : "http") + "://" + target;
		try {
			const fetchOptions = {
				"method": isPost ? "POST" : "GET",
				"credentials": "omit",
				"cache": "no-store",
				"redirect": "manual",
				"referrer": "",
			};
			if (isPost) {
				const body = new Uint8Array(postBody.length);
				for (let i = 0; i < postBody.length; i++) {
					body[i] = postBody.charCodeAt(i);
				}
				fetchOptions.headers = {"Content-Type": postContentType};
				fetchOptions.body = body;
			}
			const res = await fetch(url, fetchOptions);
			if (res.status === 200) {
				await sendToUart(new Uint8Array(await res.arrayBuffer()));
			} else if (res.type === "opaqueredirect") {
				await sendToUart(HTTP_ERROR_STRING + "301" + NEW_LINE);
			} else {
				await sendToUart(HTTP_ERROR_STRING + res.status + NEW_LINE);
			}
		} catch (e) {
			console.warn(e);
			await sendToUart(failString);
		}
	}

	async function doTasks() {
		while (taskQueue.length > 0) {
			const line = taskQueue[0];
			if (line.startsWith("MJ ")) {
				const command = line.substring(3);
				if (command.startsWith("APL")) {
					await sendToUart(APL_STRING);
				} else if (command.startsWith("APC ")) {
					const ssidAndPassword = command.substring(4);
					if (ssidAndPassword === VIRTUAL_SSID || ssidAndPassword.startsWith(VIRTUAL_SSID + " ")) {
						// SSIDが一致 (パスワードは仮想的になんでもOK)
						await sendToUart("'");
						const startTime = performance.now();
						while (performance.now() - startTime < CONNECT_SUCCESS_TIME_MS) {
							await sendToUart(".");
							await sleep(CONNECT_DOT_INTERVAL_MS);
						}
						await sendToUart(CONNECT_DONE_STRING);
						networkConnected = true;
					} else {
						// SSIDが不一致
						await sendToUart("'");
						const startTime = performance.now();
						while (performance.now() - startTime < CONNECT_ERROR_TIME_MS) {
							await sendToUart(".");
							await sleep(CONNECT_DOT_INTERVAL_MS);
						}
						await sendToUart(CONNECT_ERROR_STRING);
						networkConnected = false;
					}
				} else if (command.startsWith("APD")) {
					await sendToUart(OK_STRING);
					networkConnected = false;
				} else if (command.startsWith("APS S")) { // "APS" より先に判定する
					await sendToUart(isOnline() ? CONNECTED_STRING : NOT_CONNECTED_STRING);
				} else if (command.startsWith("APS")) {
					await sendToUart((isOnline() ? "1" : "0") + NEW_LINE);
				} else if (command.startsWith("SLEEP ")) {
					// 何もしない
				} else if (command.startsWith("SPW ")) {
					const t = parseInt(command.substring(4));
					sendWaitMs = isNaN(t) || t < 0 ? 0 : t;
					await sendToUart(OK_STRING);
				} else if (command.startsWith("GET ")) {
					await performHttpRequest(command.substring(4), false, false);
				} else if (command.startsWith("POST START ")) {
					startPost(command.substring(11));
					await sendToUart(OK_STRING);
				} else if (command.startsWith("POST END")) {
					await performHttpRequest(postURL, false, true);
					postURL = "";
					postBody = null;
				} else if (command.startsWith("GETS ")) {
					await performHttpRequest(command.substring(5), true, false);
				} else if (command.startsWith("POSTS START ")) {
					startPost(command.substring(12));
					await sendToUart(OK_STRING);
				} else if (command.startsWith("POSTS END")) {
					await performHttpRequest(postURL, true, true);
					postURL = "";
					postBody = null;
				} else if (command.startsWith("PCT ")) {
					postContentType = command.substring(4);
					await sendToUart(OK_STRING);
				} else if (command.startsWith("MAC")) {
					await sendToUart(MAC_STRING);
				} else if (command.startsWith("UDP ")) {
					// 何もしない
				} else if (command.startsWith("TCP CLOSE")) { // "TCP" より先に判定する
					await sendToUart(OK_STRING);
				} else if (command.startsWith("TCP ")) {
					await sendToUart(TCP_FAIL_STRING);
				} else {
					await sendToUart(NG_STRING);
				}
			} else {
				if (postBody !== null) postBody += line + "\n";
			}
			taskQueue.shift();
		}
	}

	function enqueueLine(lineToEnqueue) {
		const shouldStartDequeue = taskQueue.length === 0;
		taskQueue.push(lineToEnqueue);
		if (shouldStartDequeue) doTasks();
	}

	function setUartConnected(conn) {
		uartConnected = conn;
	}

	// data: Uint8Array
	function rx(data, dataBps) {
		if (!uartConnected || dataBps !== deviceBps) return;
		for (let i = 0; i < data.length; i++) {
			if (data[i] === 0x0A) {
				enqueueLine(lineBuffer);
				lineBuffer = "";
			} else {
				lineBuffer += String.fromCharCode(data[i]);
			}
		}
	}

	function tx(data) {
		if (!uartConnected) return;
		uartManager.rx(data);
	}

	return {
		"setUartConnected": setUartConnected,
		"rx": rx,
	};
})();
