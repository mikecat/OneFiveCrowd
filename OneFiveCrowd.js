"use strict";

// リトルエンディアン環境かを判定
const isLittleEndian = (function() {
	const buffer = new ArrayBuffer(4);
	const bufferBytes = new Uint8Array(buffer);
	const bufferUint = new Uint32Array(buffer);
	bufferBytes[3] = 0x44;
	bufferBytes[2] = 0x33;
	bufferBytes[1] = 0x22;
	bufferBytes[0] = 0x11;
	return bufferUint[0] === 0x44332211;
})();

const SCREEN_WIDTH = 32;
const SCREEN_HEIGHT = 24;

const ARRAY_SIZE = 102;

// ROM上の物理アドレス
const CROM_ADDR = 0x1000;
// RAM上の物理アドレス
const CRAM_ADDR = 0x0;
const ARRAY_ADDR = CRAM_ADDR + 0x100;
const VRAM_ADDR = ARRAY_ADDR + 0x100;
const PRG_ADDR = VRAM_ADDR + 0x300;

// ROMとRAMのバッファ
const romData = new ArrayBuffer(32 * 1024);
const ramData = new ArrayBuffer(4 * 1024);
// ROMとRAMのビュー
const romView = new DataView(romData);
const ramView = new DataView(ramData);
const romBytes = new Uint8Array(romData);
const ramBytes = new Uint8Array(ramData);
const arrayView = new Int16Array(ramData, ARRAY_ADDR, ARRAY_SIZE + 26);

// 環境に応じて変数と配列のアクセス方法を決定する
const readArray = isLittleEndian ? function(id) {
	// リトルエンディアン環境用
	return arrayView[id];
} : function(id) {
	// 非リトルエンディアン環境用
	return ramView.getInt16(ARRAY_ADDR + 2 * id, true);
};
const writeArray = isLittleEndian ? function(id, value) {
	// リトルエンディアン環境用
	arrayView[id] = value;
} : function(id) {
	// 非リトルエンディアン環境用
	ramView.setInt16(ARRAY_ADDR + 2 * id, value,  true);
};

// カーソル位置
var cursorX = 0;
var cursorY = 0;

// カーソルアニメーション用
var cursorDispX = -1;
var cursorDispY = -1;
var cursorOn = false;
var cursorTimerId = null;

var mainScreenContext;
const fontImages = new Array(256);

// 更新するべきか
var fontDirty = false;
var vramDirty = false;

// フォントデータを描画用のImageDataに変換する
function dataToFontImage(image, data, offset) {
	var imageData = image.data;
	for (var y = 0; y < 8; y++) {
		var line = data[offset + y];
		for (var x = 0; x < 8; x++) {
			var imageOffset = y * (4 * 16 * 2) + x * (4 * 2);
			var value = ((line >> (7 - x)) & 1) ? 255 : 0;
			imageData[imageOffset + 0] = imageData[imageOffset + 4] = value;
			imageData[imageOffset + 1] = imageData[imageOffset + 5] = value;
			imageData[imageOffset + 2] = imageData[imageOffset + 6] = value;
			imageData[imageOffset + 3] = imageData[imageOffset + 7] = 255;
			imageData[imageOffset + 64] = imageData[imageOffset + 68] = value;
			imageData[imageOffset + 65] = imageData[imageOffset + 69] = value;
			imageData[imageOffset + 66] = imageData[imageOffset + 70] = value;
			imageData[imageOffset + 67] = imageData[imageOffset + 71] = 255;
		}
	}
}

function updateScreen() {
	if (fontDirty) {
		// RAM上のフォントデータを更新する
		for (var i = 0; i < 0x20; i++) {
			dataToFontImage(fontImages[0xE0 + i], ramBytes, CRAM_ADDR + i * 8);
		}
		fontDirty = false;
		vramDirty = true;
	}
	if (vramDirty) {
		// VRAMを画面に反映させる
		for (var y = 0; y < SCREEN_HEIGHT; y++) {
			for (var x = 0; x < SCREEN_WIDTH; x++) {
				mainScreenContext.putImageData(
					fontImages[ramBytes[VRAM_ADDR + y * SCREEN_WIDTH + x]], x * 16, y * 16);
			}
		}
		if (cursorOn) {
			if (0 <= cursorX && cursorX < SCREEN_WIDTH && 0 <= cursorY && cursorY < SCREEN_HEIGHT) {
				var imageData = mainScreenContext.getImageData(cursorX * 16, cursorY * 16, 8, 16);
				for (var i = 0; i < imageData.data.length; i += 4) {
					imageData.data[i + 0] = 255 - imageData.data[i + 0];
					imageData.data[i + 1] = 255 - imageData.data[i + 1];
					imageData.data[i + 2] = 255 - imageData.data[i + 2];
				}
				mainScreenContext.putImageData(imageData, cursorX * 16, cursorY * 16);
				cursorDispX = cursorX;
				cursorDispY = cursorY;
			} else {
				cursorDispX = cursorDispY = -1;
			}
		} else {
			cursorDispX = cursorDispY = -1;
		}
		vramDirty = false;
	} else if (cursorOn && (cursorX != cursorDispX || cursorY != cursorDispY)) {
		// カーソルの位置がずれている
		// 古い位置のカーソルを消す
		mainScreenContext.putImageData(
			fontImages[ramBytes[VRAM_ADDR + cursorDispY * SCREEN_WIDTH + cursorDispX]],
			cursorDispX * 16, cursorDispY * 16);
		// 新しい位置にカーソルを描く
		if (0 <= cursorX && cursorX < SCREEN_WIDTH && 0 <= cursorY && cursorY < SCREEN_HEIGHT) {
			var imageData = mainScreenContext.getImageData(cursorX * 16, cursorY * 16, 8, 16);
			for (var i = 0; i < imageData.data.length; i += 4) {
				imageData.data[i + 0] = 255 - imageData.data[i + 0];
				imageData.data[i + 1] = 255 - imageData.data[i + 1];
				imageData.data[i + 2] = 255 - imageData.data[i + 2];
			}
			mainScreenContext.putImageData(imageData, cursorX * 16, cursorY * 16);
			cursorDispX = cursorX;
			cursorDispY = cursorY;
		} else {
			cursorDispX = cursorDispY = -1;
		}
	} else if (!cursorOn && cursorDispX >= 0 && cursorDispY >= 0) {
		// カーソルが消えたので、消す
		mainScreenContext.putImageData(
			fontImages[ramBytes[VRAM_ADDR + cursorDispY * SCREEN_WIDTH + cursorDispX]],
			cursorDispX * 16, cursorDispY * 16);
		cursorDispX = cursorDispY = -1;
	}
}

function initSystem() {
	// canvasの初期化
	var canvas = document.getElementById("mainScreen");
	mainScreenContext = canvas.getContext("2d");

	// ROMの内容の初期化
	for (var i = 0; i < 0xE0; i++) {
		for (var j = 0; j < 8; j++) {
			romBytes[CROM_ADDR + i * 8 + j] = ijfont_1_1[i * 8 + j];
		}
	}
	// ROM部分のフォントの初期化
	for (var i = 0; i < 0xE0; i++) {
		fontImages[i] = mainScreenContext.createImageData(16, 16);
		dataToFontImage(fontImages[i], romBytes, CROM_ADDR + i * 8);
	}
	// RAM用のフォントの枠を作る
	for (var i = 0; i < 0x20; i++) {
		fontImages[0xE0 + i] = mainScreenContext.createImageData(16, 16);
	}

	// 各種状態の初期化
	commandCLP();
	commandCLV();
	commandCLS();
	commandNEW();
	updateScreen();

	// カーソルを点滅させる
	if (cursorTimerId !== null) clearInterval(cursorTimerId);
	cursorTimerId = setInterval(toggleCursor, 500);
}

function toggleCursor() {
	cursorOn = !cursorOn;
	updateScreen();
}

function keyDown() {
	var key = event.key;
	if (key.length === 1) {
		putChar(key.charCodeAt(0), true);
		updateScreen();
	}
}

// 画面に文字を書き込む
function putChar(c, isInsert = false) {
	if (cursorX < 0 || SCREEN_WIDTH <= cursorX || cursorY < 0 || SCREEN_HEIGHT <= cursorY) return;
	switch (c) {
	default:
		if (isInsert) {
			// 挿入のために、以降の文字列をずらす
			var cursorPoint = cursorY * SCREEN_WIDTH + cursorX;
			var zeroPoint = cursorPoint;
			while (zeroPoint < SCREEN_WIDTH * SCREEN_HEIGHT &&
				ramBytes[VRAM_ADDR + zeroPoint] != 0) zeroPoint++;
			if (zeroPoint >= SCREEN_WIDTH * SCREEN_HEIGHT) {
				// 画面の最後まで埋まっている場合
				if (cursorY > 0) {
					// カーソルが最初の行に無いなら、1行上げる
					for (var y = 1; y < SCREEN_HEIGHT; y++) {
						for (var x = 0; x < SCREEN_WIDTH; x++) {
							ramBytes[VRAM_ADDR + (y - 1) * SCREEN_WIDTH + x]
								= ramBytes[VRAM_ADDR + y * SCREEN_WIDTH + x];
						}
					}
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						ramBytes[VRAM_ADDR + (SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					zeroPoint -= SCREEN_WIDTH;
				} else {
					// カーソルが最初の行にあるなら、最後の文字を犠牲にする
					zeroPoint--;
				}
			} else if (zeroPoint % SCREEN_WIDTH == SCREEN_WIDTH - 1 &&
			zeroPoint + 1 < SCREEN_WIDTH * SCREEN_HEIGHT) {
				// 次の行に行きそうな場合、1行下げる
				var zeroPointY = ~~(zeroPoint / SCREEN_WIDTH);
				for (var y = SCREEN_HEIGHT - 2; y > zeroPointY; y--) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						ramBytes[VRAM_ADDR + (y + 1) * SCREEN_WIDTH + x]
							= ramBytes[VRAM_ADDR + y * SCREEN_WIDTH + x];
					}
				}
				for (var x = 0; x < SCREEN_WIDTH; x++) {
					ramBytes[VRAM_ADDR + (zeroPointY + 1) * SCREEN_WIDTH + x] = 0;
				}
			}
			for (var i = zeroPoint; i > cursorPoint; i--) {
				ramBytes[VRAM_ADDR + i] = ramBytes[VRAM_ADDR + i - 1];
			}
		}
		// 文字を書き込む
		ramBytes[VRAM_ADDR + cursorY * SCREEN_WIDTH + cursorX] = c;
		cursorX++;
		if (cursorX >= SCREEN_WIDTH) {
			// 次の行に行く
			cursorX = 0;
			if (cursorY + 1 < SCREEN_HEIGHT) {
				cursorY++;
			} else {
				// 最終行だったので、1行上げる
				for (var y = 1; y < SCREEN_HEIGHT; y++) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						ramBytes[VRAM_ADDR + (y - 1) * SCREEN_WIDTH + x]
							= ramBytes[VRAM_ADDR + y * SCREEN_WIDTH + x];
					}
				}
				for (var x = 0; x < SCREEN_WIDTH; x++) {
					ramBytes[VRAM_ADDR + (SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
				}
			}
		}
		vramDirty = true;
		break;
	}
}

function commandNEW() {
	// RAMのプログラム領域を初期化する
	for (var i = 0; i < 0x400; i++) {
		ramBytes[PRG_ADDR + i] = 0;
	}
}

function commandCLS() {
	// VRAMを初期化する
	for (var i = 0; i < 0x300; i++) {
		ramBytes[VRAM_ADDR + i] = 0;
	}
	// カーソルの位置を左上に戻す
	cursorX = 0;
	cursorY = 0;
	vramDirty = true;
}

function commandCLV() {
	// 配列と変数を初期化する
	for (var i = 0; i < 0x100; i++) {
		ramBytes[ARRAY_ADDR + i] = 0;
	}
}

function commandCLP() {
	// RAMのフォント領域を初期化する
	for (var i = 0; i < 0x20; i++) {
		for (var j = 0; j < 8; j++) {
			ramBytes[CRAM_ADDR + i * 8 + j] = ijfont_1_1[(0xE0 + i) * 8 + j];
		}
	}
	fontDirty = true;
}
