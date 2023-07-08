"use strict";

const jpKeys = [
	[
		{"key": "ESC", "keyCode": "Escape"},
		{"key": "F1"},
		{"key": "F2"},
		{"key": "F3"},
		{"key": "F4"},
		{"key": "F5"},
		{"key": "F6"},
		{"key": "F7"},
		{"key": "F8"},
		{"key": "F9"},
		{"key": "F10"},
		{"key": "F11"},
		{"key": "F12"},
		{"key": "Del", "keyCode": "Delete"},
	],
	[
		null,
		{"key": "1", "shiftedKey": "!", "altedKey": "→", "shiftAltedKey": "▘"},
		{"key": "2", "shiftedKey": "\"", "altedKey": "↑", "shiftAltedKey": "▝"},
		{"key": "3", "shiftedKey": "#", "altedKey": "↓", "shiftAltedKey": "▀"},
		{"key": "4", "shiftedKey": "$", "altedKey": "♠", "shiftAltedKey": "▖"},
		{"key": "5", "shiftedKey": "%", "altedKey": "♥", "shiftAltedKey": "▌"},
		{"key": "6", "shiftedKey": "&", "altedKey": "♣", "shiftAltedKey": "▞"},
		{"key": "7", "shiftedKey": "'", "altedKey": "♦", "shiftAltedKey": "▛"},
		{"key": "8", "shiftedKey": "(", "altedKey": "⚫", "shiftAltedKey": "▗"},
		{"key": "9", "shiftedKey": ")", "altedKey": "⚪", "shiftAltedKey": "▚"},
		{"key": "0", "shiftedKey": "", "altedKey": "←", "shiftAltedKey": "　"},
		{"key": "-", "shiftedKey": "=", "altedKey": "ｭ"},
		{"key": "^", "shiftedKey": "~", "altedKey": "\u00A5"},
		{"key": "\\", "shiftedKey": "|", "altedKey": "ﾜ"},
	],
	[
		{"key": "Tab"},
		{"key": "Q", "altedKey": "🕺", "shiftAltedKey": "┗"},
		{"key": "W", "altedKey": "←"},
		{"key": "E", "altedKey": "♪", "shiftAltedKey": "▟"},
		{"key": "R", "altedKey": "💃", "shiftAltedKey": "┛"},
		{"key": "T", "altedKey": "🏃", "shiftAltedKey": "◥"},
		{"key": "Y", "altedKey": "↑"},
		{"key": "U", "altedKey": "🚶", "shiftAltedKey": "◣"},
		{"key": "I", "altedKey": "⌇", "shiftAltedKey": "┃"},
		{"key": "O", "altedKey": "🚪", "shiftAltedKey": "┏"},
		{"key": "P", "altedKey": "🕴", "shiftAltedKey": "┓"},
		{"key": "@", "shiftedKey": "`", "altedKey": "@"},
		{"key": "[", "shiftedKey": "{", "altedKey": "ﾛ"},
		{"key": "BS", "keyCode": "Backspace"},
	],
	[
		{"key": "Caps", "keyCode": "Process", "special": "caps"},
		{"key": "A", "altedKey": "🔟", "shiftAltedKey": "▐"},
		{"key": "S", "altedKey": "🏌", "shiftAltedKey": "◤"},
		{"key": "D", "altedKey": "👾", "shiftAltedKey": "▙"},
		{"key": "F", "altedKey": "🌀", "shiftAltedKey": "█"},
		{"key": "G", "altedKey": "🚀", "shiftAltedKey": "・"},
		{"key": "H", "altedKey": "🛸", "shiftAltedKey": "━"},
		{"key": "J", "altedKey": "🚁", "shiftAltedKey": "╋"},
		{"key": "K", "altedKey": "💥", "shiftAltedKey": "┫"},
		{"key": "L", "altedKey": "💰", "shiftAltedKey": "┣"},
		{"key": ";", "shiftedKey": "+"},
		{"key": ":", "shiftedKey": "*"},
		{"key": "]", "shiftedKey": "}", "altedKey": "ﾝ"},
		{"key": "⏎", "keyCode": "Enter"},
	],
	[
		{"key": "⇧", "keyCode": "Shift", "special": "shift"},
		{"key": "Z", "altedKey": "↓"},
		{"key": "X", "altedKey": "→"},
		{"key": "C", "altedKey": "🐱", "shiftAltedKey": "▄"},
		{"key": "V", "altedKey": "🍓", "shiftAltedKey": "◢"},
		{"key": "B", "altedKey": "🍙", "shiftAltedKey": "▜"},
		{"key": "N", "altedKey": "📶", "shiftAltedKey": "┳"},
		{"key": "M", "altedKey": "🧰", "shiftAltedKey": "┻"},
		{"key": ",", "shiftedKey": "<", "altedKey": "ｼ"},
		{"key": ".", "shiftedKey": ">", "altedKey": "ｾ"},
		{"key": "/", "shiftedKey": "?", "altedKey": "ｿ"},
		{"key": "\\", "shiftedKey": "_", "altedKey": "ﾜ"},
		{"key": "▲", "keyCode": "ArrowUp"},
		null,
	],
	[
		{"key": "Ctrl", "keyCode": "Control", "special": "ctrl"},
		{"key": "Alt", "special": "alt"},
		{"key": "Space", "keyCode": " ", "colSpan": 5},
		null,
		null,
		null,
		null,
		{"key": "Home"},
		{"key": "PgUp", "keyCode": "PageUp"},
		{"key": "PgDn", "keyCode": "PageDown"},
		{"key": "End"},
		{"key": "◀", "keyCode": "ArrowLeft"},
		{"key": "▼", "keyCode": "ArrowDown"},
		{"key": "▶", "keyCode": "ArrowRight"},
	],
];

const usKeys = [
	[
		{"key": "ESC", "keyCode": "Escape"},
		{"key": "F1"},
		{"key": "F2"},
		{"key": "F3"},
		{"key": "F4"},
		{"key": "F5"},
		{"key": "F6"},
		{"key": "F7"},
		{"key": "F8"},
		{"key": "F9"},
		{"key": "F10"},
		{"key": "F11"},
		{"key": "F12"},
		{"key": "Del", "keyCode": "Delete"},
	],
	[
		{"key": "~", "shiftedKey": "`"},
		{"key": "1", "shiftedKey": "!", "altedKey": "→", "shiftAltedKey": "▘"},
		{"key": "2", "shiftedKey": "@", "altedKey": "↑", "shiftAltedKey": "▝"},
		{"key": "3", "shiftedKey": "#", "altedKey": "↓", "shiftAltedKey": "▀"},
		{"key": "4", "shiftedKey": "$", "altedKey": "♠", "shiftAltedKey": "▖"},
		{"key": "5", "shiftedKey": "%", "altedKey": "♥", "shiftAltedKey": "▌"},
		{"key": "6", "shiftedKey": "^", "altedKey": "♣", "shiftAltedKey": "▞"},
		{"key": "7", "shiftedKey": "&", "altedKey": "♦", "shiftAltedKey": "▛"},
		{"key": "8", "shiftedKey": "*", "altedKey": "⚫", "shiftAltedKey": "▗"},
		{"key": "9", "shiftedKey": "(", "altedKey": "⚪", "shiftAltedKey": "▚"},
		{"key": "0", "shiftedKey": ")", "altedKey": "←", "shiftAltedKey": "　"},
		{"key": "-", "shiftedKey": "_"},
		{"key": "=", "shiftedKey": "+"},
		{"key": "BS", "keyCode": "Backspace"},
	],
	[
		{"key": "Tab"},
		{"key": "Q", "altedKey": "🕺", "shiftAltedKey": "┗"},
		{"key": "W", "altedKey": "←"},
		{"key": "E", "altedKey": "♪", "shiftAltedKey": "▟"},
		{"key": "R", "altedKey": "💃", "shiftAltedKey": "┛"},
		{"key": "T", "altedKey": "🏃", "shiftAltedKey": "◥"},
		{"key": "Y", "altedKey": "↑"},
		{"key": "U", "altedKey": "🚶", "shiftAltedKey": "◣"},
		{"key": "I", "altedKey": "⌇", "shiftAltedKey": "┃"},
		{"key": "O", "altedKey": "🚪", "shiftAltedKey": "┏"},
		{"key": "P", "altedKey": "🕴", "shiftAltedKey": "┓"},
		{"key": "[", "shiftedKey": "{"},
		{"key": "]", "shiftedKey": "}",},
		{"key": "\\", "shiftedKey": "|"},
	],
	[
		{"key": "Caps", "keyCode": "Process", "special": "caps"},
		{"key": "A", "altedKey": "🔟", "shiftAltedKey": "▐"},
		{"key": "S", "altedKey": "🏌", "shiftAltedKey": "◤"},
		{"key": "D", "altedKey": "👾", "shiftAltedKey": "▙"},
		{"key": "F", "altedKey": "🌀", "shiftAltedKey": "█"},
		{"key": "G", "altedKey": "🚀", "shiftAltedKey": "・"},
		{"key": "H", "altedKey": "🛸", "shiftAltedKey": "━"},
		{"key": "J", "altedKey": "🚁", "shiftAltedKey": "╋"},
		{"key": "K", "altedKey": "💥", "shiftAltedKey": "┫"},
		{"key": "L", "altedKey": "💰", "shiftAltedKey": "┣"},
		{"key": ";", "shiftedKey": ":"},
		{"key": "'", "shiftedKey": "\""},
		null,
		{"key": "⏎", "keyCode": "Enter"},
	],
	[
		{"key": "⇧", "keyCode":"Shift", "special": "shift"},
		{"key": "Z", "altedKey": "↓"},
		{"key": "X", "altedKey": "→"},
		{"key": "C", "altedKey": "🐱", "shiftAltedKey": "▄"},
		{"key": "V", "altedKey": "🍓", "shiftAltedKey": "◢"},
		{"key": "B", "altedKey": "🍙", "shiftAltedKey": "▜"},
		{"key": "N", "altedKey": "📶", "shiftAltedKey": "┳"},
		{"key": "M", "altedKey": "🧰", "shiftAltedKey": "┻"},
		{"key": ",", "shiftedKey": "<"},
		{"key": ".", "shiftedKey": ">"},
		{"key": "/", "shiftedKey": "?"},
		null,
		{"key": "▲", "keyCode": "ArrowUp"},
		null,
	],
	[
		{"key": "Ctrl", "keyCode": "Control", "special": "ctrl"},
		{"key": "Alt", "special": "alt"},
		{"key": "Space", "keyCode": " ", "colSpan": 5},
		null,
		null,
		null,
		null,
		{"key": "Home"},
		{"key": "PgUp", "keyCode": "PageUp"},
		{"key": "PgDn", "keyCode": "PageDown"},
		{"key": "End"},
		{"key": "◀", "keyCode": "ArrowLeft"},
		{"key": "▼", "keyCode": "ArrowDown"},
		{"key": "▶", "keyCode": "ArrowRight"},
	],
];

function createScreenKeys(keyInfo, name) {
	const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	const screenKeysMain = document.createElement("div");
	screenKeysMain.setAttribute("class", "screenKeyMain");
	const specialKeyChecks = {};
	for (let i = 0; i < keyInfo.length; i++) {
		for (let j = 0; j < keyInfo[i].length; j++) {
			if (keyInfo[i][j] !== null) {
				screenKeysMain.appendChild((function(keyData) {
					let key;
					if (keyData.special) {
						const keyCheck = document.createElement("input");
						keyCheck.setAttribute("class", "specialKeyCheck specialKey-" + keyData.special);
						keyCheck.setAttribute("type", "checkbox");
						keyCheck.setAttribute("id", "specialKey-" + name + "-" + keyData.special);
						screenKeysMain.insertBefore(keyCheck, screenKeysMain.firstChild);
						specialKeyChecks[keyData.special] = keyCheck;
						key = document.createElement("label");
						key.setAttribute("for", keyCheck.id);
						key.setAttribute("data-special-key", keyData.special);
					} else {
						key = document.createElement("span");
					}
					key.setAttribute("class", "screenKey");
					if (keyData.colSpan) {
						key.style.gridColumnStart = j + 1;
						key.style.gridColumnEnd = j + 1 + keyData.colSpan;
					} else {
						key.style.gridColumn = j + 1;
					}
					key.style.gridRow = i + 1;
					let s0a0 = document.createElement("span"), s1a0 = null, s0a1 = null, s1a1 = null;
					if (alphabets.indexOf(keyData.key) >= 0) {
						const s0c0 = document.createElement("span");
						const s0c1 = document.createElement("span");
						const s1c0 = document.createElement("span");
						const s1c1 = document.createElement("span");
						s0c0.setAttribute("class", "nocapsed");
						s0c1.setAttribute("class", "capsed");
						s1c0.setAttribute("class", "nocapsed");
						s1c1.setAttribute("class", "capsed");
						s0c0.appendChild(document.createTextNode(keyData.key));
						s0c1.appendChild(document.createTextNode(keyData.key.toLowerCase()));
						s1c0.appendChild(document.createTextNode(keyData.key.toLowerCase()));
						s1c1.appendChild(document.createTextNode(keyData.key));
						s1a0 = document.createElement("span");
						s0a0.classList.add("noshifted");
						s1a0.classList.add("shifted");
						s0a0.appendChild(s0c0);
						s0a0.appendChild(s0c1);
						s1a0.appendChild(s1c0);
						s1a0.appendChild(s1c1);
					} else {
						s0a0.appendChild(document.createTextNode(keyData.key));
						if (typeof keyData.shiftedKey !== "undefined") {
							s1a0 = document.createElement("span");
							s0a0.classList.add("noshifted");
							s1a0.classList.add("shifted");
							s1a0.appendChild(document.createTextNode(keyData.shiftedKey));
						}
					}
					if (typeof keyData.altedKey !== "undefined") {
						s0a0.classList.add("noalted");
						if (s1a0) s1a0.classList.add("noalted");
						s0a1 = document.createElement("span");
						s0a1.classList.add("alted");
						s0a1.appendChild(document.createTextNode(keyData.altedKey));
						if (typeof keyData.shiftAltedKey !== "undefined") {
							s0a1.classList.add("noshifted");
							s1a1 = document.createElement("span");
							s1a1.classList.add("alted");
							s1a1.classList.add("shifted");
							s1a1.appendChild(document.createTextNode(keyData.shiftAltedKey));
						}
					}
					key.appendChild(s0a0);
					if (s1a0) key.appendChild(s1a0);
					if (s0a1) key.appendChild(s0a1);
					if (s1a1) key.appendChild(s1a1);
					let touched = null;
					const pressed = function() {
						let keyToSend = key.innerText;
						if (keyToSend !== "") {
							if (keyData.keyCode) {
								keyToSend = keyData.keyCode;
							} else {
								if (touched in highCharsMap) {
									keyToSend = highCharsMap[touched];
								} else if (keyToSend.length === 1) {
									if (alphabets.indexOf(keyToSend) >= 0) {
										keyToSend = keyToSend.toLowerCase();
									} else if (alphabets.indexOf(keyToSend.toUpperCase()) >= 0) {
										keyToSend = keyToSend.toUpperCase();
									}
								}
							}
							if (!keyData.special || !specialKeyChecks[keyData.special].checked) {
								keyDown(keyToSend, specialKeyChecks.shift.checked, specialKeyChecks.ctrl.checked, specialKeyChecks.alt.checked);
							}
							touched = keyToSend;
						}
					};
					const released = function() {
						if (!keyData.special || specialKeyChecks[keyData.special].checked) {
							keyUp(touched);
						}
						touched = null;
					};
					key.addEventListener("mousedown", function() {
						if (touched === null) pressed();
					});
					key.addEventListener("mouseup", function() {
						if (touched !== null) released();
					});
					key.addEventListener("touchstart", function(event) {
						event.preventDefault();
						if (touched === null) pressed();
					});
					const onTouchEnd = function(event) {
						event.preventDefault();
						if (event.targetTouches.length === 0) {
							if (touched !== null) released();
							if (keyData.special) {
								const checkBox = specialKeyChecks[keyData.special];
								checkBox.checked = !checkBox.checked;
							}
						}
					};
					key.addEventListener("touchend", onTouchEnd);
					key.addEventListener("touchcancel", onTouchEnd);
					return key;
				})(keyInfo[i][j]));
			}
		}
	}
	return screenKeysMain;
}

const jpScreenKeys = createScreenKeys(jpKeys, "jp");
const usScreenKeys = createScreenKeys(usKeys, "us");

function initializeScreenKeys() {
	const keyForm = document.getElementById("keyForm");
	keyForm.appendChild(jpScreenKeys);
	keyForm.appendChild(usScreenKeys);
}

function switchScreenKeys(keyNo) {
	if (keyNo === 0) {
		jpScreenKeys.classList.add("hidden");
		usScreenKeys.classList.remove("hidden");
	} else {
		jpScreenKeys.classList.remove("hidden");
		usScreenKeys.classList.add("hidden");
	}
}
