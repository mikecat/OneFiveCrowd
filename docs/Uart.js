"use strict";

const uartManager = (function() {
	let serialPort = null;
	const connectedDevices = [];
	const connectStatusChangeCallbacks = [];
	let bps = 115200;

	function isWebSerialSupported() {
		return !!navigator.serial;
	}

	function addConnectStatusChangeCallback(func) {
		connectStatusChangeCallbacks.push(func);
	}

	function doConnectStatusChangeCallback(newStatus) {
		connectStatusChangeCallbacks.forEach(function(func) {
			func(newStatus);
		});
	}

	function isConnected() {
		return serialPort !== null;
	}

	async function connectPort(port) {
		if (serialPort !== null) {
			await closePort();
		}
		await port.open({"baudRate": bps});
		const portInfo = {
			"port": port,
			"closeRequest": false,
			"reader": null,
		};
		serialPort = portInfo;
		doConnectStatusChangeCallback(true);
		// これはawaitせず、別に走らせる
		new Promise(async function(resolve, reject) {
			while (port.readable && !portInfo.closeRequest) {
				const reader = port.readable.getReader();
				portInfo.reader = reader;
				try {
					for (;;) {
						const res = await reader.read();
						if (res.done) break;
						rx(res.value);
					}
				} catch (error) {
					console.warn(error);
				} finally {
					reader.releaseLock();
					portInfo.reader = null;
				}
			}
			resolve();
		});
	}

	async function closePort() {
		if (serialPort !== null) {
			if (serialPort.reader) {
				serialPort.closeRequest = true;
				await serialPort.reader.cancel();
			}
			await serialPort.port.close();
			serialPort = null;
			doConnectStatusChangeCallback(false);
		}
	}

	async function disconnectPort() {
		if (serialPort !== null) {
			if (serialPort.reader) {
				serialPort.closeRequest = true;
				await serialPort.reader.cancel();
			}
			await serialPort.port.forget();
			serialPort = null;
			doConnectStatusChangeCallback(false);
		}
	}

	async function initialize() {
		if (navigator.serial) {
			navigator.serial.addEventListener("connect", async function(event) {
				if (serialPort === null) {
					// ポートに接続する
					await connectPort(event.target);
				} else if (event.target !== serialPort.port) {
					// 既に接続されているところに、新しいポートが接続された
					// これは、接続されているポートが切断されている間に以前接続されたものだろう
					// よって、接続を解除する
					await event.target.forget();
				}
			});
			navigator.serial.addEventListener("disconnect", async function(event) {
				if (serialPort !== null && event.target === serialPort.port) {
					await closePort();
				}
			});
			// 初期状態で接続されているポートを得る
			const connectedPorts = await navigator.serial.getPorts();
			// 最初のポートに接続し、他の接続を解除する
			for (let i = 0; i < connectedPorts.length; i++) {
				const port = connectedPorts[i];
				if (serialPort === null) {
					await connectPort(port);
				} else if (port !== serialPort.port) {
					await port.forget();
				}
			}
		}
	}

	async function webSerialRequestPort() {
		if (serialPort !== null) return;
		if (!navigator.serial) return;
		try {
			const port = await navigator.serial.requestPort();
			await connectPort(port);
		} catch (e) {
			console.warn(e);
		}
	}

	function connectDevice(device) {
		connectedDevices.push(device);
	}

	async function setBps(newBps) {
		bps = newBps;
		if (serialPort) await connectPort(serialPort.port);
	}

	// OneFiveCrowdから周辺機器へデータを送信する
	async function tx(data) {
		let dataToSend;
		if (typeof data === "number") {
			dataToSend = new Uint8Array([data]);
		} else if (typeof data === "string") {
			dataToSend = new Uint8Array(data.length);
			for (let i = 0; i < data.length; i++) {
				dataToSend[i] = data.charCodeAt(i);
			}
		} else {
			dataToSend = data;
		}
		connectedDevices.forEach(function(device) {
			device.rx(dataToSend, bps);
		});
		if (serialPort) {
			const writer = serialPort.port.writable.getWriter();
			try {
				await writer.write(dataToSend);
			} catch (e) {
				console.warn(e);
			} finally {
				writer.releaseLock();
			}
		}
	}

	// OneFiveCrowdが周辺機器からデータを受信する
	function rx(data) {
		if (typeof data === "string") {
			const receivedData = new Uint8Array(data.length);
			for (let i = 0; i < data.length; i++) {
				receivedData[i] = data.charCodeAt(i);
			}
			receiveFromUart(receivedData);
		} else {
			receiveFromUart(data);
		}
	}

	return {
		"initialize": initialize,
		"addConnectStatusChangeCallback": addConnectStatusChangeCallback,
		"isConnected": isConnected,
		"isWebSerialSupported": isWebSerialSupported,
		"webSerialRequestPort": webSerialRequestPort,
		"disconnectPort": disconnectPort,
		"connectDevice": connectDevice,
		"setBps": setBps,
		"tx": tx,
		"rx": rx,
	};
})();
