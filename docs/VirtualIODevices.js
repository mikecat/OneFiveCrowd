"use strict";

const clickButton = (function() {
	const configId = "clickButton";

	let connectedCheck;
	let portToConnectSelect;
	let signalPressedSelect;

	let isClicked = false, isTouched = false;

	function queryIn(queriedPorts, isAnalog) {
		const isPressed = isClicked || isTouched;
		const isHigh = signalPressedSelect.value === "0" ? !isPressed : isPressed;
		const value = isHigh ? (isAnalog ? 1023 : 1) : 0;
		const result = {};
		queriedPorts.forEach((port) => {
			result[port] = value;
		});
		return result;
	}

	function initialize(configDataSet) {
		const configData = configId in configDataSet ? configDataSet[configId] : {};
		connectedCheck = document.getElementById("virtualIOClickButtonConnect");
		signalPressedSelect = document.getElementById("virtualIOClickButtonSignalPressed");
		const portToConnectArea = document.getElementById("virtualIOClickButtonPortToConnectArea");
		portToConnectSelect = ioManager.createPortSelect(true, false, "port" in configData ? configData.port : "btn");
		portToConnectArea.appendChild(portToConnectSelect);
		connectedCheck.checked = "connect" in configData ? configData.connect : true;
		setSelectByValue(signalPressedSelect, "signalPressed" in configData ? configData.signalPressed : 0);
		const setOutputPortList = ioManager.registerDevice("クリックボタン", {"en": "Click Button"}, function(){}, queryIn);
		const updateOutputPortList = function() {
			setOutputPortList(portToConnectSelect.value === "" ? [] : [portToConnectSelect.value]);
		};
		portToConnectSelect.addEventListener("change", updateOutputPortList);
		updateOutputPortList();

		document.body.addEventListener("mousedown", function() {
			isClicked = true;
		});
		document.body.addEventListener("mouseup", function() {
			isClicked = false;
		});
		const touchHandler = function(event) {
			event.preventDefault();
			isTouched = event.targetTouches.length > 0;
		};
		document.body.addEventListener("touchstart", touchHandler);
		document.body.addEventListener("touchend", touchHandler);
		document.body.addEventListener("touchcancel", touchHandler);
	}

	return {
		"initialize": initialize,
	};
})();
