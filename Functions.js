"use strict";

function modifierCHR(args) {
	// 文字として出力する
	let ret = "";
	for (let i = 0; i < args.length; i++) {
		ret += String.fromCharCode(args[i]);
	}
	return ret;
}

function modifierDEC(args) {
	// 10進数で出力する
	// 桁数が指定より多かったら捨て、少なかったら空白で埋める
	// 桁数0以下は指定なしとして扱う
	const value = args[0], digits = args.length >= 2 ? args[1] : 0;
	let ret = value.toString(10);
	if (digits > 0) {
		if (ret.length > digits) {
			ret = ret.substring(ret.length - digits);
		} else {
			while (ret.length < digits) ret = " " + ret;
		}
	}
	return ret;
}

function modifierHEX(args) {
	// 大文字の16進数で出力する
	// 桁数が指定より多かったら捨て、少なかったら数字で埋める
	// 埋める数字は、8桁ごとに繰り返す
	// 桁数0は指定なしとして扱う
	// 桁数0未満のときは空文字列を出力する
	const value = args[0], digits = args.length >= 2 ? args[1] : 0;
	if (digits < 0) return "";
	let ret = (value >>> 0).toString(16).toUpperCase();
	if (ret.length > 4) ret = ret.substring(ret.length - 4);
	if (digits > 0) {
		if (ret.length > digits) {
			ret = ret.substring(ret.length - digits);
		} else {
			const retUnit = "00000000".substring(0, 8 - ret.length) + ret;
			if (digits <= 8) {
				ret = retUnit.substring(retUnit.length - digits);
			} else {
				ret = retUnit.substring(retUnit.length - (digits % 8));
				for (let i = digits % 8; i < digits; i += 8) ret += retUnit;
			}
		}
	}
	return ret;
}

function modifierBIN(args) {
	// 2進数で出力する
	// 桁数が指定より多かったら捨て、少なかったら数字で埋める
	// 埋める数字は、32桁ごとに繰り返す
	// 桁数0は指定なしとして扱う
	// 桁数0未満のときは空文字列を出力する
	const value = args[0], digits = args.length >= 2 ? args[1] : 0;
	if (digits < 0) return "";
	let ret = (value >>> 0).toString(2);
	if (ret.length > 16) ret = ret.substring(ret.length - 16);
	if (digits > 0) {
		if (ret.length > digits) {
			ret = ret.substring(ret.length - digits);
		} else {
			const retUnit = "00000000000000000000000000000000".substring(0, 32 - ret.length) + ret;
			if (digits <= 32) {
				ret = retUnit.substring(retUnit.length - digits);
			} else {
				ret = retUnit.substring(retUnit.length - (digits % 32));
				for (let i = digits % 8; i < digits; i += 32) ret += retUnit;
			}
		}
	}
	return ret;
}

function modifierSTR(args) {
	// 仮想メモリ内の文字列として出力する
	// 桁数が多かったら捨て、少ない場合は無視してあるだけ出力する
	// 桁数0は、空文字列を出力する
	// 桁数0未満は、指定なしとして扱う
	const addr = args[0], digits = args.length >= 2 ? args[1] : -1;
	let ret = "";
	for (let i = 0; digits < 0 || i < digits; i++) {
		const c = readVirtualMem(addr + i);
		if (c === 0 || c === 0x22) break;
		ret += String.fromCharCode(c);
	}
	return ret;
}

function functionBTN(args) {
	// ボタンの状態を取得する
	const btnId = args.length > 0 ? args[0] : 0;
	if (btnId < 0) {
		return btnStatus;
	} else {
		switch (btnId) {
			case 0: // 本体ボタン
				return 0;
			case 28: // ←
				return btnStatus & 1;
			case 29: // →
				return (btnStatus >> 1) & 1;
			case 30: // ↑
				return (btnStatus >> 2) & 1;
			case 31: // ↓
				return (btnStatus >> 3) & 1;
			case 32: // スペース
				return (btnStatus >> 4) & 1;
			case 88: // X
				return (btnStatus >> 5) & 1;
			default:
				return 0;
		}
	}
}

function functionTICK(args) {
	// 時刻を取得する
	const isHiRes = args.length > 0 && args[0] !== 0;
	const tick = (performance.now() - tickOrigin) / 1000 * TICK_PER_SECOND * (isHiRes ? TICK_HIRES_MULT : 1);
	return Math.floor(tick) % 32768;
}

function functionINKEY() {
	// キー入力を1文字取得する
	const key = dequeueKey();
	if (key < 0) return 0;
	if (key === 0) return 0x100;
	return key;
}

function functionSCR(args) {
	// 指定した位置のVRAMを読む
	if (args.length !== 0 && args.length !== 2) throw "Syntax error";
	const x = args.length === 0 ? cursorX : args[0];
	const y = args.length === 0 ? cursorY : args[1];
	if (x < 0 || SCREEN_WIDTH <= x || y < 0 || SCREEN_HEIGHT <= y) return 0;
	return vramView[SCREEN_WIDTH * y + x];
}

function functionABS(args) {
	// 絶対値を得る
	const value = args[0];
	if (value === -32768 || value >= 0) return value;
	return -value;
}

function functionFREE() {
	// プログラムの残り容量を得る
	let ptr = 0;
	while (ptr + 3 <= prgView.length) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		const lineSize = prgView[ptr + 2];
		if (lineNo === 0) break;
		ptr += lineSize + 4;
	}
	return ptr > prgView.length ? 0 : prgView.length - ptr;
}

function functionPEEK(args) {
	// 仮想メモリからデータを読み込む
	return readVirtualMem(args[0]);
}

function functionLINE() {
	// 実行中の行番号を得る
	return currentLine;
}

function functionLEN(args) {
	// 文字列の長さを得る
	let count = 0;
	let ptr = args[0];
	for (;;) {
		const c = readVirtualMem(ptr + count);
		if (c == 0 || c == 0x22) return count;
		count++;
	}
}

function functionRND(args) {
	// 0以上第一引数未満の乱数を返す
	const max = args[0];
	if (randomSeeded) {
		const t = seededX ^ (seededX << 11);
		seededX = seededY;
		seededY = seededZ;
		seededZ = seededW;
		seededW = ((seededW ^ (seededW >>> 19)) ^ (t ^ (t >>> 8))) >>> 0;
		return max <= 0 ? 0 : (seededW >>> 1) % max;
	} else {
		return max <= 0 ? 0 : (Math.random() * max) >>> 0;
	}
}

function functionPOS(args) {
	// カーソル位置や画面サイズを得る
	const select = args.length > 0 ? args[0] : 0;
	switch (select) {
		case 1: return cursorX;
		case 2: return cursorY;
		case 3: return SCREEN_WIDTH;
		case 4: return SCREEN_HEIGHT;
		default: return SCREEN_WIDTH * cursorY + cursorX;
	}
}

function functionPOINT(args) {
	// 指定の座標に点があるかを返す、またはカーソル位置の文字コードを得る
	if (args.length !== 2) return functionSCR(args);
	const x = args[0], y = args[1];
	if (x < 0 || SCREEN_WIDTH * 2 <= x || y < 0 || SCREEN_HEIGHT * 2 <= y) return 0;
	const c = functionSCR([x >> 1, y >> 1]);
	if (c === 0) {
		return 0;
	} else if (0x80 <= c && c <= 0x8f) {
		const offset = (x & 1) + 2 * (y & 1);
		return (c >> offset) & 1;
	} else {
		return 1;
	}
}

function functionCOS(args){
	// 余弦の256倍を返す
	return Math.round(Math.cos(args[0] * Math.PI / 180) * 256);
}

function functionSIN(args){
	// 正弦の256倍を返す
	return Math.round(Math.sin(args[0] * Math.PI / 180) * 256);
}
