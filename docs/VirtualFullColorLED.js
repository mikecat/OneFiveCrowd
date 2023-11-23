"use strict";

const virtualFullColorLed = (function() {
	let ledBaseElement, configForm, configArea;
	const ledElements = [];

	function generateLedElements(num) {
		for (let i = ledElements.length; i < num; i++) {
			const led = document.createElement("div");
			led.setAttribute("class", "virtualFullColorLed");
			ledBaseElement.appendChild(led);
			ledElements.push(led);
		}
		for (let i = 0; i < ledElements.length; i++) {
			ledElements[i].style.display = i < num ? "" : "none";
		}
	}

	const LED_SIZE = 20;
	const LED_PADDING = 5;

	function renderLEDs() {
		if (!configForm.connect.checked) {
			ledBaseElement.style.display = "none";
			// 切断時、光の設定をリセットする
			for (let i = 0; i < ledElements.length; i++) {
				ledElements[i].style.backgroundColor = "";
			}
			return;
		}
		ledBaseElement.style.display = "inline-block";
		try {
			if (configForm.type.value === "matrix") {
				const width = parseInt(configForm.matrixWidth.value, 10);
				const height = parseInt(configForm.matrixHeight.value, 10);
				if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
					throw "invalid number of LEDs";
				}
				ledBaseElement.style.width = (LED_PADDING + (LED_SIZE + LED_PADDING) * width) + "px";
				ledBaseElement.style.height = (LED_PADDING + (LED_SIZE + LED_PADDING) * height) + "px";
				ledBaseElement.style.clipPath = "";
				generateLedElements(width * height);
				let x = configForm.matrixStart.value.startsWith("left_") ? 0 : width - 1;
				let y = configForm.matrixStart.value.endsWith("_top") ? 0 : height - 1;
				let dx = configForm.matrixStart.value.startsWith("left_") ? 1 : -1;
				let dy = configForm.matrixStart.value.endsWith("_top") ? 1 : -1;
				let count = 0;
				const zigzag = configForm.matrixZigzag.checked;
				if (configForm.matrixDir.value === "horizontal") {
					while (0 <= y && y < height) {
						ledElements[count].style.top = (LED_PADDING + (LED_SIZE + LED_PADDING) * y + LED_SIZE / 2) + "px";
						ledElements[count].style.left = (LED_PADDING + (LED_SIZE + LED_PADDING) * x + LED_SIZE / 2) + "px";
						x += dx;
						if (x < 0 || width <= x) {
							if (zigzag) {
								x -= dx;
								dx = -dx;
							} else {
								x = (x + width) % width;
							}
							y += dy;
						}
						count++;
					}
				} else {
					while (0 <= x && x < width) {
						ledElements[count].style.top = (LED_PADDING + (LED_SIZE + LED_PADDING) * y + LED_SIZE / 2) + "px";
						ledElements[count].style.left = (LED_PADDING + (LED_SIZE + LED_PADDING) * x + LED_SIZE / 2) + "px";
						y += dy;
						if (y < 0 || height <= y) {
							if (zigzag) {
								y -= dy;
								dy = -dy;
							} else {
								y = (y + height) % height;
							}
							x += dx;
						}
						count++;
					}
				}
			} else if (configForm.type.value === "ring") {
				const num = parseInt(configForm.ringSize.value, 10);
				if (isNaN(num) || num <= 0) {
					throw "invalid number of LEDs";
				}
				generateLedElements(num);
				if (num === 1) {
					const size = LED_SIZE + LED_PADDING * 2;
					const radius = size / 2;
					ledBaseElement.style.width = size + "px";
					ledBaseElement.style.height = size + "px";
					ledBaseElement.style.clipPath = "path(\"M " + radius + "," + size +
						" A" + radius + " " + radius + " 0 1 1 " + radius + ",0 A" +
						radius + " " + radius + " 0 1 1 " + radius + "," + size + " Z\")";
					ledElements[0].style.top = radius + "px";
					ledElements[0].style.left = radius + "px";
				} else {
					// LEDの中心同士の距離が LED_SIZE + LED_PADDING になるような配置半径を求める
					// 余弦定理 a^2 = b^2 + c^2 - 2bc cos A より b = c のとき
					// a^2 = 2 b^2 (1 - cos A)
					// ∴ b = sqrt(a^2 / (2 (1 - cos A)))
					const ledDistance = LED_SIZE + LED_PADDING
					const ledRadius = Math.sqrt(ledDistance * ledDistance / (2 * (1 - Math.cos(Math.PI * 2 / num))));
					const allRadius = ledRadius + LED_SIZE / 2 + LED_PADDING;
					const allSize = allRadius * 2;
					const innerRadius = ledRadius - LED_SIZE / 2 - LED_PADDING;
					const startAngle = configForm.ringStart.value === "left" ? Math.PI * 3 / 2 :
						configForm.ringStart.value === "right" ? Math.PI / 2 :
						configForm.ringStart.value === "down" ? Math.PI : 0;
					const angleMult = configForm.ringDir.value === "anticlockwise" ? -1 : 1;
					ledBaseElement.style.width = allSize + "px";
					ledBaseElement.style.height = allSize + "px";
					for (let i = 0; i < num; i++) {
						const angle = startAngle + angleMult * Math.PI * 2 * i / num;
						ledElements[i].style.top = (allRadius - ledRadius * Math.cos(angle)) + "px";
						ledElements[i].style.left = (allRadius + ledRadius * Math.sin(angle)) + "px";
					}
					let clipPath = "path(evenodd, \"M " + allRadius + "," + allSize +
						" A" + allRadius + " " + allRadius + " 0 1 1 " + allRadius + ",0 A" +
						allRadius + " " + allRadius + " 0 1 1 " + allRadius + "," + allSize;
					if (innerRadius > 0) {
						clipPath += " V " + (allRadius + innerRadius) +
						" A " + innerRadius + " " + innerRadius + " 0 1 1 " + allRadius + "," + (allRadius - innerRadius) +
						" A " + innerRadius + " " + innerRadius + " 0 1 1 " + allRadius + "," + (allRadius + innerRadius);
					}
					ledBaseElement.style.clipPath = clipPath + " Z\")";
				}
			} else {
				throw "unknown LED type";
			}
		} catch (e) {
			console.warn(e);
			ledBaseElement.style.display = "none";
		}
	}

	const colorTable = [];

	function setColors(data, numRepeat, ports) {
		if (ports.indexOf("led") < 0) return;
		const dataOrder = configForm.dataOrder.value;
		const rIndex = dataOrder.indexOf("r");
		const gIndex = dataOrder.indexOf("g");
		const bIndex = dataOrder.indexOf("b");
		const setTo = [-1, -1, -1];
		if (0 <= rIndex && rIndex < 3) setTo[rIndex] = 0;
		if (0 <= gIndex && gIndex < 3) setTo[gIndex] = 1;
		if (0 <= bIndex && bIndex < 3) setTo[bIndex] = 2;
		const dataNum = Math.min(data.length * numRepeat, ledElements.length);
		for (let i = 0; i < dataNum; i++) {
			const colorData = [0, 0, 0];
			for (let j = 0; j < 3; j++) {
				if (setTo[j] >= 0) colorData[setTo[j]] = colorTable[data[i % data.length][j]];
			}
			ledElements[i].style.backgroundColor = "rgb(" + colorData.join(",") + ")";
		}
	}

	function initialize() {
		ledBaseElement = document.getElementById("virtualFullColorLed");
		configForm = document.getElementById("virtualFullColorLedConfigForm");
		configArea = document.getElementById("virtualFullColorLedConfigArea");

		for (let i = 0; i < 256; i++) {
			colorTable.push(Math.round(Math.pow(i / 255, 1 / 5) * 255));
		}
		wsLedManager.addDevice(setColors);

		const syncLedType = function() {
			const type = configForm.type.value;
			configArea.classList.remove("matrixSelected");
			configArea.classList.remove("ringSelected");
			if (type === "matrix") configArea.classList.add("matrixSelected");
			if (type === "ring") configArea.classList.add("ringSelected");
		};
		configForm.type.forEach((element) => element.addEventListener("change", syncLedType));
		syncLedType();

		configForm.addEventListener("input", renderLEDs);
		renderLEDs();
	}

	return {
		"initialize": initialize,
	};
})();
