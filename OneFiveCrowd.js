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
const KEY_MAX = 126;
const CMD_MAX = 200; // 本体の長さ。終端の0でさらに1バイト使う。

// ROM上の物理アドレス
const CROM_ADDR = 0x1000;
// RAM上の物理アドレス
const CRAM_ADDR = 0x0;
const ARRAY_ADDR = CRAM_ADDR + 0x100;
const VRAM_ADDR = ARRAY_ADDR + 0x100;
const PRG_ADDR = VRAM_ADDR + 0x300;
const KEY_ADDR = PRG_ADDR + 0x400 + 3;
const CMD_ADDR = KEY_ADDR + 1 + KEY_MAX;

// ROMとRAMのバッファ
const romData = new ArrayBuffer(32 * 1024);
const ramData = new ArrayBuffer(4 * 1024);
// ROMとRAMのビュー
const romView = new DataView(romData);
const ramView = new DataView(ramData);
const romBytes = new Uint8Array(romData);
const ramBytes = new Uint8Array(ramData);
// 役割ごとのRAMのビュー
const cramView = new Uint8Array(ramData, CRAM_ADDR, 0x100);
const arrayView = new Int16Array(ramData, ARRAY_ADDR, ARRAY_SIZE + 26);
const vramView = new Uint8Array(ramData, VRAM_ADDR, 0x300);
const prgView = new Uint8Array(ramData, PRG_ADDR, 0x400);
const keyView = new Uint8Array(ramData, KEY_ADDR, 1 + KEY_MAX);
const cmdView = new Uint8Array(ramData, CMD_ADDR, CMD_MAX + 1);

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

// キー入力でブロックした時、ブロック解除での飛び先
var keyCallback = null;

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
			dataToFontImage(fontImages[0xE0 + i], cramView, i * 8);
		}
		fontDirty = false;
		vramDirty = true;
	}
	if (vramDirty) {
		// VRAMを画面に反映させる
		for (var y = 0; y < SCREEN_HEIGHT; y++) {
			for (var x = 0; x < SCREEN_WIDTH; x++) {
				mainScreenContext.putImageData(
					fontImages[vramView[y * SCREEN_WIDTH + x]], x * 16, y * 16);
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
		if (cursorDispX >= 0 && cursorDispY >= 0) {
			mainScreenContext.putImageData(
				fontImages[vramView[cursorDispY * SCREEN_WIDTH + cursorDispX]],
				cursorDispX * 16, cursorDispY * 16);
		}
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
			fontImages[vramView[cursorDispY * SCREEN_WIDTH + cursorDispX]],
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
	commandCLK();
	commandCLS();
	commandNEW();
	updateScreen();

	// カーソルを点滅させる
	if (cursorTimerId !== null) clearInterval(cursorTimerId);
	cursorTimerId = setInterval(toggleCursor, 500);

	// インタラクティブモードに入る
	setTimeout(doInteractive, 0);
}

function toggleCursor() {
	cursorOn = !cursorOn;
	updateScreen();
}

function enqueueKey(key) {
	if (keyView[0] < KEY_MAX) {
		keyView[1 + keyView[0]] = key;
		keyView[0]++;
	}
}

function dequeueKey() {
	var nKey = keyView[0];
	if (nKey <= 0) return -1;
	var key = keyView[1];
	for (var i = 1; i < nKey; i++) {
		keyView[i] = keyView[i + 1];
	}
	keyView[0]--;
	return key;
}

function keyInput(key, invokeCallback = true) {
	if (typeof(key) === "number") {
		enqueueKey(key);
	} else {
		if (key.length === 0) return;
		for (var i = 0; i < key.length; i++) {
			keyInput(key.charCodeAt(i), false);
		}
	}
	if (invokeCallback && keyCallback !== null) {
		setTimeout(keyCallback, 0);
		keyCallback = null;
	}
}

const specialKeyDict = {
	"Tab"        : "  ",
	"Escape"     : 0x1b,
	"ArrowLeft"  : 0x1c,
	"ArrowRight" : 0x1d,
	"ArrowUp"    : 0x1e,
	"ArrowDown"  : 0x1f,
	"Backspace"  : 0x08,
	"Delete"     : 0x7f,
	"Home"       : 0x12,
	"PageUp"     : 0x13,
	"PageDown"   : 0x14,
	"End"        : 0x17,
	"F1"  : "\x13\x0c",
	"F2"  : "\x18LOAD",
	"F3"  : "\x18SAVE",
	"F4"  : "\x18\x0cLIST\x0a",
	"F5"  : "\x18RUN\x0a",
	"F6"  : "\x18?FREE()\x0a",
	"F7"  : "\x18OUT0\x0a",
	"F8"  : "\x18VIDEO1\x0a",
	"F9"  : "\x18\x0cFILES\x0a"
};

function keyDown() {
	event.preventDefault();
	var key = event.key;
	if (event.ctrlKey) {
		if (key === "a" || key === "A") keyInput(0x12); // 行頭へ
		if (key === "c" || key === "C") keyInput(0x1b); // ESC
		else if (key === "e" || key === "E") keyInput(0x17); // 行末へ
		else if (key === "k" || key === "K") keyInput(0x0c); // カーソル以降を削除
		else if (key === "l" || key === "L") keyInput("\x13\x0c"); // 全て削除
		else if (key === "Shift") keyInput(0x0f); // アルファベット/カナ切り替え
		else if (key === "Alt") keyInput(0x11); // 挿入/上書き切り替え
	} else if (key.length === 1) {
		var keyCode = key.charCodeAt(0);
		// アルファベット大文字と小文字を入れ替える
		if (0x61 <= keyCode && keyCode <= 0x7a) keyCode -= 0x20;
		else if (0x41 <= keyCode && keyCode <= 0x5a) keyCode += 0x20;
		if (event.altKey) {
			if (0x21 <= keyCode && keyCode <= 0x29) keyCode += 0x81 - 0x21;
			else if (keyCode === 0x2c) keyCode = 0x3c;
			else if (keyCode === 0x2d) keyCode = 0xad;
			else if (keyCode === 0x2e) keyCode = 0xbe;
			else if (keyCode === 0x2f) keyCode = 0xbf;
			else if (0x30 <= keyCode && keyCode <= 0x39) keyCode += 0xe0 - 0x30;
			else if (keyCode === 0x3c) keyCode = 0x5c;
			else if (keyCode === 0x3d) keyCode = 0x4d;
			else if (keyCode === 0x3e) keyCode = 0x5e;
			else if (keyCode === 0x3f) keyCode = 0x3f;
			else if (0x41 <= keyCode && keyCode <= 0x56) keyCode += 0xea - 0x41;
			else if (0x57 <= keyCode && keyCode <= 0x5a) keyCode += 0xe0 - 0x57;
			else if (0x5b <= keyCode && keyCode <= 0x5d) keyCode += 0xdb - 0x5b;
			else if (keyCode === 0x5e) keyCode = 0xa0;
			else if (keyCOde === 0x5f) keyCode = 0x7c;
			else if (0x61 <= keyCode && keyCode <= 0x76) keyCode += 0x8a - 0x61;
			else if (0x77 <= keyCode && keyCode <= 0x7a) keyCode += 0x80 - 0x77;
			else if (keyCode === 0x7e) keyCode = 0x40;
		}
		if (event.shiftKey && keyCode == 0x20) keyCode = 0x0e;
		keyInput(keyCode);
	} else if (!event.altKey) {
		if (key === "Enter") {
			keyInput(event.shiftKey ? 0x10 : 0x0a);
		} else if (key in specialKeyDict) {
			keyInput(specialKeyDict[key]);
		}
	}
	return false;
}

// 画面に文字を書き込む
var moveCursorMode = false, moveCursorX = null;
function putChar(c, isInsert = false) {
	if (moveCursorMode) {
		if (moveCursorX === null) {
			moveCursorX = c - 32;
			if (moveCursorX < 0) moveCursorX = 0;
			if (moveCursorX >= SCREEN_WIDTH) moveCursorX = SCREEN_WIDTH - 1;
		} else {
			cursorX = moveCursorX;
			cursorY = c - 32;
			if (cursorY < -1) cursorY = -1;
			if (cursorY >= SCREEN_HEIGHT) cursorY = SCREEN_HEIGHT - 1;
			moveCurssorMode = false;
			moveCursorX = null;
		}
		return;
	}
	if (cursorX < 0 || SCREEN_WIDTH <= cursorX || cursorY < 0 || SCREEN_HEIGHT <= cursorY) return;
	switch (c) {
	case 0x08: // Backspace
		if (cursorX > 0 || (cursorY > 0 && vramView[cursorY * SCREEN_WIDTH - 1] != 0)) {
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH - 1;
			const start = cursorY * SCREEN_WIDTH + cursorX - 1;
			var stop;
			for (stop = start; stop < limit && vramView[stop] !== 0; stop++);
			for (var i = start; i < stop; i++) {
				vramView[i] = vramView[i + 1];
			}
			vramView[stop] = 0;
			if (cursorX > 0) {
				cursorX--;
			} else {
				cursorX = SCREEN_WIDTH - 1;
				cursorY--;
			}
			vramDirty = true;
		}
		break;
	case 0x09: // Tab
		putChar(0x20, isInsert);
		putChar(0x20, isInsert);
		break;
	case 0x0a: // 改行
		while (vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else {
				if (cursorY + 1 < SCREEN_HEIGHT) {
					cursorX = 0;
					cursorY++;
				} else {
					break;
				}
			}
		}
		cursorX = 0;
		if (cursorY + 1 < SCREEN_HEIGHT) {
			cursorY++;
		} else {
			for (var y = 1; y < SCREEN_HEIGHT; y++) {
				for (var x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(y - 1) * SCREEN_WIDTH + x] =
						vramView[y * SCREEN_WIDTH + x];
				}
			}
			for (var x = 0; x < SCREEN_WIDTH; x++) {
				vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
			}
			vramDirty = true;
		}
		break;
	case 0x0c: // カーソル位置以降を全削除
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			for (var i = cursorY * SCREEN_WIDTH + cursorX; i < limit; i++) {
				vramView[i] = 0;
			}
			vramDirty = true;
		}
		break;
	case 0x0d: // 無視
		break;
	case 0x0e: // 空白挿入
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			var start = cursorY * SCREEN_WIDTH + cursorX;
			var end;
			for (end = start; end < limit && vramView[end] !== 0; end++);
			if (end === limit) {
				// 最後まで詰まっている
				if (cursorY > 0) {
					for (var y = 1; y < SCREEN_HEIGHT; y++) {
						for (var x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y - 1) * SCREEN_WIDTH + x] =
								vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					start -= SCREEN_WIDTH;
					end -= SCREEN_WIDTH;
				}
			} else if (end % SCREEN_WIDTH === SCREEN_WIDTH - 1 &&
			end + 1 < limit && vramView[end + 1] !== 0) {
				// 空行を挿入してからやる
				const endY = ~~(end / SCREEN_WIDTH) + 1;
				for (var y = SCREEN_HEIGHT - 1; y > endY; y--) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[y * SCREEN_WIDTH + x] =
							vramView[(y - 1) * SCREEN_WIDTH + x];
					}
				}
				for (var x = 0; x < SCREEN_WIDTH; x++) {
 					vramView[endY * SCREEN_WIDTH + x] = 0;
				}
			}
			if (end === limit) end--;
			for (var i = end; i > start; i--) {
				vramView[i] = vramView[i - 1];
			}
			vramView[start] = 0x20;
			vramDirty = true;
		}
		break;
	case 0x0f: // 無視
		break;
	case 0x10: // 行分割
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			var start = cursorY * SCREEN_WIDTH + cursorX;
			var end;
			for (end = start; end < limit && vramView[end] !== 0; end++);
			var endX = (end === limit ? SCREEN_WIDTH : end % SCREEN_WIDTH);
			var endY = (end === limit ? SCREEN_HEIGHT - 1 : ~~(end / SCREEN_WIDTH));
			if (cursorX <= endX) {
				// 新しい行を要求する
				var shiftUp = false;
				if (cursorY > 0) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						if (vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] !== 0) {
							shiftUp = true;
							break;
						}
					}
				}
				if (shiftUp) {
					// 行末がある行までを上に上げる
					for (var y = 0; y < endY; y++) {
						for (var x = 0; x < SCREEN_WIDTH; x++) {
							vramView[y * SCREEN_WIDTH + x] =
								vramView[(y + 1) * SCREEN_WIDTH + x];
						}
					}
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[endY * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					start -= SCREEN_WIDTH;
					end -= SCREEN_WIDTH;
				} else {
					// 行末がある行の次からを下に下げる
					for (var y = SCREEN_HEIGHT - 2; y > endY; y--) {
						for (var x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y + 1) * SCREEN_WIDTH + x] =
								vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(endY + 1) * SCREEN_WIDTH + x] = 0;
					}
				}
			}
			// 行分割の操作を行う
			var dest = ~~((start + SCREEN_WIDTH) / SCREEN_WIDTH) * SCREEN_WIDTH;
			for (var i = end - 1; i >= start; i--) {
				vramView[i - start + dest] = vramView[i];
			}
			for (var i = start; i < dest; i++) {
				vramView[i] = 0;
			}
			cursorX = 0;
			cursorY = ~~(dest / SCREEN_WIDTH);
			vramDirty = true;
		}
		break;
	case 0x11: // 無視
		break;
	case 0x12: // カーソルを行頭に移動
		while ((cursorX > 0 || cursorY > 0) &&
		vramView[cursorY * SCREEN_WIDTH + cursorX - 1] !== 0) {
			if (cursorX > 0) {
				cursorX--;
			} else {
				cursorX = SCREEN_WIDTH - 1;
				cursorY--;
			}
		}
		break;
	case 0x13: // カーソルを左上に移動
		cursorX = 0;
		cursorY = 0;
		break;
	case 0x14: // カーソルを左下に移動
		cursorX = 0;
		cursorY = SCREEN_HEIGHT - 1;
		break;
	case 0x15: // カーソルを指定位置に移動
		moveCursorMode = true;
		moveCursorX = null;
		break;
	case 0x17: // カーソルを行末に移動
		while (vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else {
				if (cursorY + 1 < SCREEN_HEIGHT) {
					cursorX = 0;
					cursorY++;
				} else {
					break;
				}
			}
		}
		break;
	case 0x18: // カーソルがある行を削除
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			var start = cursorY * SCREEN_WIDTH + cursorX;
			if (start > 0 && vramView[start] === 0) start--;
			var stop = start;
			if (vramView[start] !== 0) {
				for (; start > 0 && vramView[start - 1] !== 0; start--);
			}
			for (; stop < limit && vramView[stop] !== 0; stop++);
			if (start == stop) break;
			for (var i = start; i < stop; i++) {
				vramView[i] = 0;
			}
			cursorX = start % SCREEN_WIDTH;
			cursorY = ~~(start / SCREEN_WIDTH);
			vramDirty = true;
		}
		break;
	case 0x1c: // カーソルを左に移動
		if (cursorX > 0) {
			cursorX--;
		} else if (cursorY > 0 && (!isInsert || vramView[cursorY * SCREEN_WIDTH - 1] !== 0)) {
			cursorX = SCREEN_WIDTH - 1;
			cursorY--;
		}
		break;
	case 0x1d: // カーソルを右に移動
		if (!isInsert || vramView[cursorY * SCREEN_WIDTH + cursorX] !== 0) {
			if (cursorX + 1 < SCREEN_WIDTH) {
				cursorX++;
			} else if (cursorY + 1 < SCREEN_HEIGHT) {
				cursorX = 0;
				cursorY++;
			}
		}
		break;
	case 0x1e: // カーソルを上に移動
		if (cursorY > 0) {
			cursorY--;
			if (isInsert && vramView[cursorY * SCREEN_WIDTH + cursorX] === 0) {
				while (cursorX > 0 && vramView[cursorY * SCREEN_WIDTH + cursorX - 1] === 0) {
					cursorX--;
				}
			}
		}
		break;
	case 0x1f: // カーソルを下に移動
		if (cursorY + 1 < SCREEN_HEIGHT) {
			cursorY++;
			if (isInsert && vramView[cursorY * SCREEN_WIDTH + cursorX] === 0) {
				while (cursorX > 0 && vramView[cursorY * SCREEN_WIDTH + cursorX - 1] === 0) {
					cursorX--;
				}
			}
		}
		break;
	case 0x7f: // Delete
		{
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH - 1;
			const start = cursorY * SCREEN_WIDTH + cursorX;
			var stop;
			for (stop = start; stop < limit && vramView[stop] !== 0; stop++);
			for (var i = start; i < stop; i++) {
				vramView[i] = vramView[i + 1];
			}
			vramView[stop] = 0;
			vramDirty = true;
		}
		break;
	default:
		if (isInsert) {
			// 挿入のために、以降の文字列をずらす
			var cursorPoint = cursorY * SCREEN_WIDTH + cursorX;
			var zeroPoint = cursorPoint;
			while (zeroPoint < SCREEN_WIDTH * SCREEN_HEIGHT &&
				vramView[zeroPoint] !== 0) zeroPoint++;
			if (zeroPoint >= SCREEN_WIDTH * SCREEN_HEIGHT) {
				// 画面の最後まで埋まっている場合
				if (cursorY > 0) {
					// カーソルが最初の行に無いなら、1行上げる
					for (var y = 1; y < SCREEN_HEIGHT; y++) {
						for (var x = 0; x < SCREEN_WIDTH; x++) {
							vramView[(y - 1) * SCREEN_WIDTH + x]
								= vramView[y * SCREEN_WIDTH + x];
						}
					}
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
					}
					cursorY--;
					cursorPoint -= SCREEN_WIDTH;
					zeroPoint -= SCREEN_WIDTH;
				} else {
					// カーソルが最初の行にあるなら、最後の文字を犠牲にする
					zeroPoint--;
				}
			} else if (zeroPoint % SCREEN_WIDTH === SCREEN_WIDTH - 1 &&
			zeroPoint + 1 < SCREEN_WIDTH * SCREEN_HEIGHT && vramView[zeroPoint + 1] !== 0) {
				// 次の行に行きそうな場合、1行下げる
				var zeroPointY = ~~(zeroPoint / SCREEN_WIDTH);
				for (var y = SCREEN_HEIGHT - 2; y > zeroPointY; y--) {
					for (var x = 0; x < SCREEN_WIDTH; x++) {
						vramView[(y + 1) * SCREEN_WIDTH + x]
							= vramView[y * SCREEN_WIDTH + x];
					}
				}
				for (var x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(zeroPointY + 1) * SCREEN_WIDTH + x] = 0;
				}
			}
			for (var i = zeroPoint; i > cursorPoint; i--) {
				vramView[i] = vramView[i - 1];
			}
		}
		// 文字を書き込む
		vramView[cursorY * SCREEN_WIDTH + cursorX] = c;
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
						vramView[(y - 1) * SCREEN_WIDTH + x]
							= vramView[y * SCREEN_WIDTH + x];
					}
				}
				for (var x = 0; x < SCREEN_WIDTH; x++) {
					vramView[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + x] = 0;
				}
			}
		}
		vramDirty = true;
		break;
	}
}

function doInteractive() {
	for (;;) {
		var key = dequeueKey();
		if (key < 0) {
			// キー入力がないので、処理を保留する
			updateScreen();
			keyCallback = doInteractive;
			return;
		}
		putChar(key, true);
		if (key === 0x0a && cursorY > 0) {
			const limit = SCREEN_HEIGHT * SCREEN_WIDTH;
			var start = (cursorY - 1) * SCREEN_WIDTH + cursorX;
			var end = start;
			if (vramView[start] !== 0) {
				while (start > 0 && vramView[start - 1] !== 0) start--;
				while (end < limit && vramView[end] !== 0) end++;
				if (end - start <= CMD_MAX) {
					for (var i = start; i < end; i++) {
						cmdView[i - start] = vramView[i];
					}
					cmdView[end - start] = 0;
					try {
						// TODO: 実行部分に渡す
						compile(CMD_ADDR);
					} catch (e) {
						// TODO: PRINT文の機能を作ったら、それを使う
						const es = "" + e + "\n";
						for (var i = 0; i < es.length; i++) {
							putChar(es.charCodeAt(i), false);
						}
					}
				} else {
					// TODO: PRINT文の機能を作ったら、それを使う
					const message = "Line too long\n";
					for (var i = 0; i < message.length; i++) {
						putChar(message.charCodeAt(i), false);
					}
				}
			}
		}
	}
}

function compile(addr) {
	var source = "";
	for (var i = addr; addr < ramBytes.length && ramBytes[i] !== 0; i++) {
		source += String.fromCharCode(ramBytes[i]);
	}
	const tokens = lexer(source, addr);
	console.log(tokens);
	const ast = parser(tokens);
	console.log(ast);
	return [];
}

function commandCLK() {
	// キーバッファを初期化する
	keyView[0] = 0;
}

function commandNEW() {
	// RAMのプログラム領域を初期化する
	for (var i = 0; i < 0x400; i++) {
		prgView[i] = 0;
	}
}

function commandCLS() {
	// VRAMを初期化する
	for (var i = 0; i < 0x300; i++) {
		vramView[i] = 0;
	}
	// カーソルの位置を左上に戻す
	cursorX = 0;
	cursorY = 0;
	moveCursorMode = false;
	moveCursorX = null;
	vramDirty = true;
}

function commandCLV() {
	// 配列と変数を初期化する
	for (var i = 0; i < ARRAY_SIZE + 26; i++) {
		arrayView[i] = 0;
	}
}

function commandCLP() {
	// RAMのフォント領域を初期化する
	for (var i = 0; i < 0x20; i++) {
		for (var j = 0; j < 8; j++) {
			cramView[i * 8 + j] = ijfont_1_1[(0xE0 + i) * 8 + j];
		}
	}
	fontDirty = true;
}
