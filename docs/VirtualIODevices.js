"use strict";

const clickButton = (function() {
	const configId = "clickButton";

	const tagsToFilter = {
		"input": true, "label": true, "textarea": true, "button": true,
		"select": true, "a": true, "summary": true,
	};
	const idsToFilter = {
		"padForm": true,
	};
	const classesToFilter = [
		"screenKey",
	];

	function isEventToIgnore(event) {
		let element = event.target;
		for (;;) {
			if (typeof element.tagName === "string" && element.tagName.toLowerCase() in tagsToFilter) return true;
			if (element.id in idsToFilter) return true;
			if (element.classList && classesToFilter.some((name) => element.classList.contains(name))) return true;
			if (!element.parentNode) return false;
			element = element.parentNode;
		}
	}

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
			setOutputPortList(!connectedCheck.checked || portToConnectSelect.value === "" ? [] : [portToConnectSelect.value]);
		};
		connectedCheck.addEventListener("change", updateOutputPortList);
		portToConnectSelect.addEventListener("change", updateOutputPortList);
		updateOutputPortList();

		document.body.addEventListener("mousedown", function(event) {
			if (isEventToIgnore(event)) return;
			isClicked = true;
		});
		document.body.addEventListener("mouseup", function(event) {
			if (isEventToIgnore(event)) return;
			isClicked = false;
		});
		const touchHandler = function(event) {
			if (isEventToIgnore(event)) return;
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
