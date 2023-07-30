"use strict";

// このファイルは、OneFiveCrowd に対する CC BY 4.0 ライセンス (by みけCAT) の対象外とする。
// This file is NOT subject of CC BY 4.0 license (by MikeCAT) for OneFiveCrowd.

// このファイルは、CC BY-NC 4.0 ライセンスで提供する。(by みけCAT)
// This file is provided under CC BY-NC 4.0 license (by MikeCAT)
// https://creativecommons.org/licenses/by-nc/4.0/deed.ja

const virtualPanCake = (function() {
	const colorPalette = [
		[0, 0, 0], [255, 255, 255], [227, 27, 41], [255, 104, 139],
		[242, 126, 48], [255, 203, 61], [255, 222, 169], [107, 74, 43],
		[145, 202, 24], [28, 77, 55], [67, 175, 215], [38, 74, 208],
		[26, 36, 102], [99, 55, 187], [178, 63, 171], [204, 204, 204],
	];
	const PANCAKE_SCREEN_WIDTH = 80, PANCAKE_SCREEN_HEIGHT = 45;
	const PANCAKE_SPRITE_WIDTH = 8, PANCAKE_SPRITE_HEIGHT = 8;
	let canvas = null, canvasContext = null, imageData = null;
	const screenBuffers = [
		new Uint8Array(PANCAKE_SCREEN_WIDTH * PANCAKE_SCREEN_HEIGHT),
		new Uint8Array(PANCAKE_SCREEN_WIDTH * PANCAKE_SCREEN_HEIGHT),
	];
	let currentScreenBuffer = 0, enableDoubleBuffering = false;

	// 起動時の画面を最初のリソース画像にする
	{
		const img = getResourceImage(0);
		const sb = screenBuffers[0];
		for (let i = 0; i < sb.length; i++) {
			sb[i] = img ? img[i] : 0;
		}
	}

	const DEVICE_BPS_DEFAULT = 115200;
	let uartConnected = false, isFirstConnection = true;
	let deviceBps = DEVICE_BPS_DEFAULT;

	let lineBuffer = "";
	let binaryLineLengthExpected = null;

	function getResourceImage(id) {
		if (typeof virtualPanCakeResource_NC === "undefined") return null;
		if (id < 0 || virtualPanCakeResource_NC.images.length <= id) return null;
		return virtualPanCakeResource_NC.images[id];
	}

	function getResourceSprite(id) {
		if (typeof virtualPanCakeResource_NC === "undefined") return null;
		if (id < 0 || virtualPanCakeResource_NC.sprites.length <= id) return null;
		return virtualPanCakeResource_NC.sprites[id];
	}

	function setCanvasEnabled(enabled) {
		if (!canvas) return;
		if (enabled) {
			canvas.classList.add("enabled");
		} else {
			canvas.classList.remove("enabled");
		}
	}

	function updateCanvas() {
		if (!canvasContext) return;
		const screenBuffer = screenBuffers[enableDoubleBuffering ? currentScreenBuffer : 0];
		for (let i = 0; i < PANCAKE_SCREEN_WIDTH * PANCAKE_SCREEN_HEIGHT; i++) {
			imageData.data[4 * i + 0] = colorPalette[screenBuffer[i]][0];
			imageData.data[4 * i + 1] = colorPalette[screenBuffer[i]][1];
			imageData.data[4 * i + 2] = colorPalette[screenBuffer[i]][2];
			imageData.data[4 * i + 3] = 255;
		}
		canvasContext.putImageData(imageData, 0, 0);
	}

	function getScreenBuffer() {
		return screenBuffers[enableDoubleBuffering ? 1 - currentScreenBuffer : currentScreenBuffer];
	}

	function clear(args) {
		if (args.length < 1) return;
		const color = args[0] & 0xf;
		const sb = getScreenBuffer();
		for (let i = 0; i < sb.length; i++) sb[i] = color;
		updateCanvas();
	}

	function image(args) {
		if (args.length < 1) return;
		const imgData = getResourceImage(args[0]);
		if (!imgData) return;
		const sb = getScreenBuffer();
		for (let i = 0; i < sb.length; i++) sb[i] = imgData[i];
		updateCanvas();
	}

	function video(args) {
		if (args.length < 1) return;
		setCanvasEnabled(args[0] !== 0);
	}

	function reset() {
		// 初期化するもの
		// ・ダブルバッファリングの状態 (WBUF)
		// ・起動時に表示されている画面バッファ
		// 初期化しないもの
		// ・画面出力有効/無効設定 (PC VIDEO xx)
		// ・通信速度 (BPS)
		// ・起動時に表示されていない画面バッファ
		currentScreenBuffer = 0;
		enableDoubleBuffering = false;
		const img = getResourceImage(0);
		const sb = screenBuffers[0];
		for (let i = 0; i < sb.length; i++) {
			sb[i] = img ? img[i] : 0;
		}
		updateCanvas();
	}

	function bps(args, rawCommand) {
		if (args.length < 2) return;
		let newBps;
		if (rawCommand === null) {
			// バイナリモード : 下位バイトが先
			newBps = args[0] | (args[1] << 8);
		} else {
			// テキストモード : 上位バイトが先
			newBps = (args[0] << 8) | args[1];
		}
		deviceBps = newBps === 0 ? DEVICE_BPS_DEFAULT : newBps;
	}

	function wbuf(args) {
		if (args.length < 1) return;
		const newEnable = args[0] !== 0;
		if (newEnable && enableDoubleBuffering) {
			currentScreenBuffer = 1 - currentScreenBuffer;
		} else if (!newEnable) {
			currentScreenBuffer = 0;
		}
		enableDoubleBuffering = newEnable;
		updateCanvas();
	}

	const functionTableText = {
		"CLEAR": clear,
		"IMAGE": image,
		"VIDEO": video,
		"RESET": reset,
		"BPS": bps,
		"WBUF": wbuf,
	};
	const functionTableBinary = {
		0x00: clear,
		0x04: image,
		0x05: video,
		0x0D: reset,
		0x13: bps,
		0x17: wbuf,
	};

	function setCanvas(newCanvas) {
		canvas = newCanvas;
		canvasContext = canvas.getContext("2d", {"alpha": false});
		imageData = canvasContext.createImageData(PANCAKE_SCREEN_WIDTH, PANCAKE_SCREEN_HEIGHT);
		updateCanvas();
	}

	function setUartConnected(conn) {
		uartConnected = conn;
		if (conn && isFirstConnection) {
			setCanvasEnabled(true);
			isFirstConnection = false;
		}
	}

	// data: Uint8Array
	function rx(data, dataBps) {
		if (!uartConnected || dataBps !== deviceBps) return;
		for (let i = 0; i < data.length; i++) {
			if (binaryLineLengthExpected === null && data[i] === 0x0a) {
				// テキストモードのコマンド終端 (改行)
				let commandAndParams = "";
				if (lineBuffer.startsWith("PC ")) commandAndParams = lineBuffer.substring(3);
				else if (lineBuffer.startsWith("PANCAKE ")) commandAndParams = lineBuffer.substring(8);
				let spaceSearchStart = 0;
				if (commandAndParams.startsWith("SPRITE ")) spaceSearchStart = 7;
				else if (commandAndParams.startsWith("MUSIC ")) spaceSearchStart = 6;
				const spacePos = commandAndParams.indexOf(" ", spaceSearchStart);
				let command, paramsStr;
				if (spacePos < 0) {
					command = commandAndParams;
					paramsStr = "";
				} else {
					command = commandAndParams.substring(0, spacePos);
					paramsStr = commandAndParams.substring(spacePos + 1);
				}
				// 16進数の文字以外を削除し、先頭から数値に変換する
				// これにより、2文字ずつの部分も、画像データなど連続している部分も、共通で変換できる
				// 実機のパース方法とは違いそうだが、仕様外の入力に対する挙動は保証しないことにした
				const params = [];
				const paramsHex = paramsStr.replace(/[^0-9a-fA-F]/g, "");
				for (let i = 0; i < paramsHex.length; i++) {
					params.push(parseInt(paramsHex.substring(i, i + 2), 16));
				}
				// テキストモードでは、渡された生のテキストも関数に渡す
				// これにより、16進数でないMMLも読み取れるようにする
				if (command in functionTableText) {
					functionTableText[command](params, paramsStr);
				}
				lineBuffer = "";
				binaryLineLengthExpected = null;
			} else if (lineBuffer.length === 0 && data[i] === 0x80) {
				// バイナリモード開始
				binaryLineLengthExpected = -1;
			} else if (binaryLineLengthExpected === -1) {
				// バイナリ長さ取得
				binaryLineLengthExpected = data[i] - 2;
				if (binaryLineLengthExpected <= 0) {
					// バイナリコマンドの中身が無く、無効
					lineBuffer = "";
					binaryLineLengthExpected = null;
				}
			} else {
				lineBuffer += String.fromCharCode(data[i]);
				if (lineBuffer.length === binaryLineLengthExpected) {
					// バイナリモードのコマンド終端
					const params = [];
					// 最初はコマンドの種類なので飛ばす
					for (let i = 1; i < lineBuffer.length; i++) {
						params.push(lineBuffer.charCodeAt(i));
					}
					// バイナリモードでは、生テキストとして null を渡す
					// これにより、テキストモードとの区別がつく
					const command = lineBuffer.charCodeAt(0);
					if (command in functionTableBinary) {
						functionTableBinary[command](params, null);
					}
					lineBuffer = "";
					binaryLineLengthExpected = null;
				}
			}
		}
	}

	function tx(data) {
		if (!uartConnected) return;
		uartManager.rx(data);
	}

	return {
		"setCanvas": setCanvas,
		"setUartConnected": setUartConnected,
		"rx": rx,
	};
})();