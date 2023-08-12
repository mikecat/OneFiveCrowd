"use strict";

const ioManager = (function() {
	// ポートリスト
	// id            : 操作対象のポートをプログラムから指定する用の文字列
	// name          : 表示用の文字列
	// defaultStatus : リセット時のstatus (null: リセット時に設定しない、周辺機器用)
	const portInfo = [
		{"id": "in1", "name": "IN1/OUT8", "defaultStatus": "input_pullup"},
		{"id": "in2", "name": "IN2/OUT9", "defaultStatus": "input"},
		{"id": "in3", "name": "IN3/OUT10", "defaultStatus": "input"},
		{"id": "in4", "name": "IN4/OUT11", "defaultStatus": "input_pullup"},
		{"id": "out1", "name": "OUT1/IN5", "defaultStatus": "output_binary"},
		{"id": "out2", "name": "OUT2/IN6", "defaultStatus": "output_binary"},
		{"id": "out3", "name": "OUT3/IN7", "defaultStatus": "output_binary"},
		{"id": "out4", "name": "OUT4/IN8", "defaultStatus": "output_binary"},
		{"id": "out5", "name": "OUT5/IN10", "defaultStatus": "output_binary"},
		{"id": "out6", "name": "OUT6/IN11", "defaultStatus": "output_binary"},
		{"id": "btn", "name": "BTN/IN9", "defaultStatus": "input"},
		{"id": "led", "name": "LED/OUT7", "defaultStatus": "output_binary"},
	];
	// 現在のポートの状態
	const portStatus = {};
	portInfo.forEach(function(info) {
		portStatus[info.id] = {
			// 表示用の名前
			"name": info.name,
			// 状態
			// input         : 入力 (プルアップなし)
			// input_pullup  : 入力 (プルアップあり)
			// output_binary : LOW/HIGHの出力
			// output_pwm    : PWM出力
			// output_analog : アナログ出力
			"status": info.defaultStatus,
			// output_binary 用の出力値 0: LOW 1: HIGH
			"binaryValue": 0,
			// output_pwm 用の出力設定 (PWMコマンドで指定する値そのまま)
			"pwmValue": 0, // パルス幅
			"pwmPeriod": 2000, // パルス周期
			// output_analog 用の出力値を表す整数 0～1023
			"analogValue": 0,
		};
	});
	// ポートの状態や入力を表すDOMを管理するオブジェクトの連想配列
	const portDomObjects = {};
	// ポートに関係する周辺機器のリスト
	// statusCallback : 状態の変化を通知する関数
	// providingIn    : その周辺機器が出力しているポートのリスト
	// queryIn        : 入力を取得する関数
	const deviceList = [];

	// ポートを追加する (周辺機器用)
	// portList : 以下の要素を持つオブジェクトの配列
	//   id            : ポートID (プログラム用)
	//   name          : ポート名 (表示用)
	//   defaultStatus : リセット時のstatus (省略・null可)
	//   status        : status (省略・null可)
	function addPorts(portList) {
		portList.forEach(function(port) {
			portInfo.push({
				"id": port.id,
				"name": port.name,
				"defaultStatus": "defaultStatus" in port ? port.defaultStatus : null,
			});
			portStatus[port.id] = {
				"name": info.name,
				"status": "status" in port && port.status !== null ? port.status : ("defaultStatus" in port && port.defaultStatus !== null ? port.defaultStatus : "input"),
				"binaryValue": 0,
				"pwmValue": 0,
				"pwmPeriod": 2000,
				"analogValue": 0,
			};
		});
	}

	// 周辺機器を追加する
	// name           : 周辺機器の名前
	// statusCallback : ポートの状態変化を通知する関数
	// queryIn        : 入力を取得する関数
	// 返り値 : この周辺機器が出力しているポートのリストを設定する関数
	function registerDevice(name, statusCallback, queryIn) {
		const deviceInfo = {
			"name": name,
			"statusCallback": statusCallback,
			"providingIn": {},
			"queryIn": queryIn,
		};
		deviceList.push(deviceInfo);
		// portList : 出力しているポートのリスト (配列)
		return function(portList) {
			const affectedPortList = Object.keys(deviceInfo.providingIn);
			const newProvidingIn = {};
			portList.forEach(function(port) {
				newProvidingIn[port] = true;
				if (!(port in deviceInfo.providingIn)) affectedPortList.push(port);
			});
			deviceInfo.providingIn = newProvidingIn;
			// 各ポートが入力を得るデバイスを更新する
			affectedPortList.forEach(function(affectedPort) {
				let inputDeviceName = null;
				for (let i = 0; i < deviceList.length; i++) {
					if (affectedPort in deviceList[i].providingIn) {
						inputDeviceName = deviceList[i].name;
						break;
					}
				}
				portDomObjects[affectedPort].setInputDevice(inputDeviceName);
			});
		};
	}

	// ポート一覧を取得する
	function getPortList() {
		return portInfo;
	}

	// 全ポートの状態を取得する
	function getPortStatus() {
		return portStatus;
	}

	// ポート一覧のDOMを生成する
	function initialize() {
		const ioPortTableBody = document.getElementById("ioPortTableBody");
		while (ioPortTableBody.firstChild) {
			ioPortTableBody.removeChild(ioPortTableBody.firstChild);
		}
		portInfo.forEach(function(port) {
			const portRow = document.createElement("tr");
			// 名前
			const nameColumn = document.createElement("td");
			nameColumn.appendChild(document.createTextNode(port.name));
			portRow.appendChild(nameColumn);
			// 出力
			const outputColumn = document.createElement("td");
			outputColumn.setAttribute("class", "ioPortOutputCell");
			const outputElement = document.createElement("span");
			outputElement.setAttribute("class", "ioPortOutputInfo");
			outputElement.appendChild(document.createTextNode("●"));
			outputColumn.appendChild(outputElement);
			const noOutputElement = document.createElement("span");
			noOutputElement.setAttribute("class", "ioPortInputInfo");
			noOutputElement.appendChild(document.createTextNode("-"));
			outputColumn.appendChild(noOutputElement);
			portRow.appendChild(outputColumn);
			// 詳細
			const detailColumn = document.createElement("td");
			const outputDetailElement = document.createElement("span");
			outputDetailElement.setAttribute("class", "ioPortOutputInfo");
			const outputDetailBinaryElement = document.createElement("span");
			outputDetailBinaryElement.setAttribute("class", "ioPortOutputInfoBinary");
			outputDetailBinaryElement.appendChild(document.createTextNode("デジタル出力 "));
			const outputDetailBinaryHighElement = document.createElement("span");
			outputDetailBinaryHighElement.setAttribute("class", "ioPortOutputInfoBinaryHigh");
			outputDetailBinaryHighElement.appendChild(document.createTextNode("HIGH"));
			outputDetailBinaryElement.appendChild(outputDetailBinaryHighElement);
			const outputDetailBinaryLowElement = document.createElement("span");
			outputDetailBinaryLowElement.setAttribute("class", "ioPortOutputInfoBinaryLow");
			outputDetailBinaryLowElement.appendChild(document.createTextNode("LOW"));
			outputDetailBinaryElement.appendChild(outputDetailBinaryLowElement);
			outputDetailElement.appendChild(outputDetailBinaryElement);
			const outputDetailPwmElement = document.createElement("span");
			outputDetailPwmElement.setAttribute("class", "ioPortOutputInfoPwm");
			outputDetailPwmElement.appendChild(document.createTextNode("PWM出力 "));
			const outputDetailPwmInfoElement = document.createElement("span");
			outputDetailPwmElement.appendChild(outputDetailPwmInfoElement);
			outputDetailElement.appendChild(outputDetailPwmElement);
			const outputDetailAnalogElement = document.createElement("span");
			outputDetailAnalogElement.setAttribute("class", "ioPortOutputInfoAnalog");
			outputDetailAnalogElement.appendChild(document.createTextNode("アナログ出力 "));
			const outputDetailAnalogInfoElement = document.createElement("span");
			outputDetailAnalogElement.appendChild(outputDetailAnalogInfoElement);
			outputDetailElement.appendChild(outputDetailAnalogElement);
			detailColumn.appendChild(outputDetailElement);
			const inputDetailElement = document.createElement("span");
			inputDetailElement.setAttribute("class", "ioPortInputInfo");
			const inputDetailDevice = document.createElement("span");
			inputDetailDevice.setAttribute("class", "ioPortInputInfoDevice");
			inputDetailElement.appendChild(inputDetailDevice);
			const inputDetailUI = document.createElement("span");
			inputDetailUI.setAttribute("class", "ioPortInputUI");
			const binaryToggleButton = document.createElement("button");
			binaryToggleButton.setAttribute("type", "button");
			binaryToggleButton.appendChild(document.createTextNode("L/H"));
			inputDetailUI.appendChild(binaryToggleButton);
			const binaryPushLowButton = document.createElement("button");
			binaryPushLowButton.setAttribute("type", "button");
			binaryPushLowButton.appendChild(document.createTextNode("押→L"));
			inputDetailUI.appendChild(binaryPushLowButton);
			const binaryPushHighButton = document.createElement("button");
			binaryPushHighButton.setAttribute("type", "button");
			binaryPushHighButton.appendChild(document.createTextNode("押→H"));
			inputDetailUI.appendChild(binaryPushHighButton);
			inputDetailUI.appendChild(document.createTextNode("L"));
			const analogInput = document.createElement("input");
			analogInput.setAttribute("type", "range");
			analogInput.setAttribute("min", "0");
			analogInput.setAttribute("max", "1023");
			analogInput.setAttribute("value", "0");
			inputDetailUI.appendChild(analogInput);
			inputDetailUI.appendChild(document.createTextNode("H"));
			inputDetailElement.appendChild(inputDetailUI);
			detailColumn.appendChild(inputDetailElement);
			portRow.appendChild(detailColumn);
			// 行をテーブルに加える
			ioPortTableBody.appendChild(portRow);
			// UIの操作を行う関数を登録する
			binaryToggleButton.addEventListener("click", function() {
				analogInput.value = analogInput.value < 512 ? 1023 : 0;
			});
			binaryPushLowButton.addEventListener("mousedown", function() {
				analogInput.value = 0;
			});
			binaryPushLowButton.addEventListener("mouseup", function() {
				analogInput.value = 1023;
			});
			const binaryPushLowButtonTouchHandler = function(event) {
				event.preventDefault();
				analogInput.value = event.targetTouches.length === 0 ? 1023 : 0;
			};
			binaryPushLowButton.addEventListener("touchstart", binaryPushLowButtonTouchHandler);
			binaryPushLowButton.addEventListener("touchend", binaryPushLowButtonTouchHandler);
			binaryPushLowButton.addEventListener("touchcancel", binaryPushLowButtonTouchHandler);
			binaryPushHighButton.addEventListener("mousedown", function() {
				analogInput.value = 1023;
			});
			binaryPushHighButton.addEventListener("mouseup", function() {
				analogInput.value = 0;
			});
			const binaryPushHighButtonTouchHandler = function(event) {
				event.preventDefault();
				analogInput.value = event.targetTouches.length === 0 ? 0 : 1023;
			};
			binaryPushHighButton.addEventListener("touchstart", binaryPushHighButtonTouchHandler);
			binaryPushHighButton.addEventListener("touchend", binaryPushHighButtonTouchHandler);
			binaryPushHighButton.addEventListener("touchcancel", binaryPushHighButtonTouchHandler);
			let currentPower = {"binary": 0, "pwm": 0, "analog": 0}, currentMode = "binary";
			let pwmValue = 0, pwmPeriod = 2000;
			portDomObjects[port.id] = {
				"setPortStatus": function(query) {
					if (query.status.substring(0, 5) === "input") {
						portRow.classList.remove("output");
					} else {
						portRow.classList.add("output");
					}
					switch (query.status) {
						case "output_binary":
							currentMode = "binary";
							outputDetailElement.classList.add("binary");
							outputDetailElement.classList.remove("pwm");
							outputDetailElement.classList.remove("analog");
							break;
						case "output_pwm":
							currentMode = "pwm";
							outputDetailElement.classList.remove("binary");
							outputDetailElement.classList.add("pwm");
							outputDetailElement.classList.remove("analog");
							break;
						case "output_analog":
							currentMode = "analog";
							outputDetailElement.classList.remove("binary");
							outputDetailElement.classList.remove("pwm");
							outputDetailElement.classList.add("analog");
							break;
					}
					if ("binaryValue" in query) {
						if (query.binaryValue) {
							outputDetailElement.classList.add("binaryHigh");
							currentPower.binary = 1;
						} else {
							outputDetailElement.classList.remove("binaryHigh");
							currentPower.binary = 0;
						}
					}
					if ("pwmValue" in query) pwmValue = query.pwmValue;
					if ("pwmPeriod" in query) pwmPeriod = query.pwmPeriod;
					if (("pwmValue" in query) || ("pwmPeriod" in query)) {
						outputDetailPwmInfoElement.textContent = "" + pwmValue + " / " + pwmPeriod; // TODO
						currentPower.pwm = pwmPeriod === 0 ? 0 : (pwmValue / (pwmPeriod < 0 ? -pwmPeriod * 480 : pwmPeriod));
					}
					if ("analogValue" in query) {
						outputDetailAnalogInfoElement.textContent = query.analogValue; // TODO
						currentPower.analog = query.analogValue / 1023;
					}
					const rawOutputPower = currentPower[currentMode];
					const outputPower = rawOutputPower < 0 ? 0 : (rawOutputPower > 1 ? 1 : rawOutputPower);
					const r = 0x77 + (0xff - 0x77) * outputPower;
					const g = 0x33 + (0x55 - 0x33) * outputPower;
					const b = 0x33 + (0x55 - 0x33) * outputPower;
					outputElement.style.color = "rgb(" + r + " " + g + " " + b + ")";
				},
				"setInputDevice": function(deviceName) {
					if (deviceName === null) {
						inputDetailElement.classList.remove("device");
					} else {
						inputDetailElement.classList.add("device");
						inputDetailDevice.textContent = deviceName;
					}
				},
				"getValue": function(isAnalog) {
					if (isAnalog) {
						return analogInput.value;
					} else {
						return analogInput.value < 512 ? 0 : 1;
					}
				},
			};
		});
	}

	// ポートの状態をデフォルトに戻す
	async function reset() {
		const resetQuery = [];
		portInfo.forEach(function(port) {
			if (port.defaultStatus !== null) {
				resetQuery.push({
					"id": port.id,
					"status": port.defaultStatus,
					"binaryValue": 0,
					"pwmValue": 0,
					"pwmPeriod": 2000,
					"analogValue": 0,
				});
			}
		});
		await setPortStatus(resetQuery);
	}

    // ポートの状態や出力を設定し、周辺機器に通知する
	// infoList : 以下の要素を持つオブジェクト、またはその配列 (ID以外、設定しない要素は省略可)
	//   id          : 設定するポートのID
	//   status      : 設定する状態
	//   binaryValue : 設定するLOW/HIGH出力値
	//   pwmValue    : 設定するPWMパルス幅
	//   pwmPeriod   : 設定するPWM周期
	//   analogValue : 設定するアナログ出力値
	async function setPortStatus(infoList) {
		const notifyDataSet = {};
		(Array.isArray(infoList) ? infoList : [infoList]).forEach(function(query) {
			if (query.id in portStatus) {
				const info = portStatus[query.id];
				const newStatus = "status" in query ? query.status : info.status;
				const notifyData = {
					"status": newStatus,
				};
				if ("binaryValue" in query) info.binaryValue = query.binaryValue;
				if ("pwmValue" in query) info.pwmValue = query.pwmValue;
				if ("pwmPeriod" in query) info.pwmPeriod = query.pwmPeriod;
				if ("analogValue" in query) info.analogValue = query.analogValue;
				switch (newStatus) {
					case "output_binary":
						notifyData.binaryValue = info.binaryValue;
						break;
					case "output_pwm":
						notifyData.pwmValue = info.pwmValue;
						notifyData.pwmPeriod = info.pwmPeriod;
						break;
					case "output_analog":
						notifyData.analogValue = info.analogValue;
						break;
				}
				portDomObjects[query.id].setPortStatus(notifyData);
				notifyDataSet[query.id] = notifyData;
			}
		});
		for (let i = 0; i < deviceList.length; i++) {
			await deviceList[i].statusCallback(notifyDataSet);
		}
	}

	// ポートから入力を得る
	// portList : 入力を得るポートのID、またはその配列
	// isAnalog : 入力モードを表す真理値 false: デジタル入力 true: アナログ入力
	// 返り値 : IDをキー、得た入力の値を値とする連想配列
	//   入力の値は、デジタル入力の場合、LOWを0、HIGHを1で表す
	//               アナログ入力の場合、0～1023で表す
	async function queryIn(portList, isAnalog) {
		const results = {};
		const queryLeft = Array.isArray(portList) ? portList.concat() : [portList];
		for (let i = 0; i < deviceList.length; i++) {
			const device = deviceList[i];
			const deviceQuery = [];
			for (let i = 0; i < queryLeft.length; i++) {
				if (queryLeft[i] in device.providingIn) {
					deviceQuery.push(queryleft[i]);
					queryleft.splice(i, 1);
					i--;
				}
			}
			if (deviceQuery.length > 0) {
				const deviceResult = await device.queryIn(deviceQuery, isAnalog);
				deviceQuery.forEach(function(id) {
					results[id] = deviceResult[id];
				});
			}
		}
		queryLeft.forEach(function(query) {
			results[query] = portDomObjects[query].getValue(isAnalog);
		});
		return results;
	}

	return {
		"addPorts": addPorts,
		"registerDevice": registerDevice,
		"getPortList": getPortList,
		"getPortStatus": getPortStatus,
		"initialize": initialize,
		"reset": reset,
		"setPortStatus": setPortStatus,
		"queryIn": queryIn,
	};
})();
