"use strict";

function commandRUN() {
	// プログラムを最初の行から実行する
	if (prgDirty) compileProgram();
	let lineToExecute = -1;
	const keys = Object.keys(programs);
	for (let i = 0; i < keys.length; i++) {
		const lineNo = parseInt(keys[i]);
		if (!isNaN(lineNo) && lineNo > 0 && (lineToExecute <= 0 || lineNo < lineToExecute)) {
			lineToExecute = lineNo;
		}
	}
	return [lineToExecute, 0];
}

function commandGOTO(args) {
	// プログラムを指定の行から実行する
	if (prgDirty) compileProgram();
	if (args[0] > 0 && (args[0] in programs)) {
		return [args[0], 0];
	} else {
		throw "Line error";
	}
}

function commandEND(){
	// プログラムの実行を終了する
	return [-1, 0];
}

function commandPOKE(args) {
	// 仮想メモリにデータを書き込む
	for (let i = 1; i < args.length; i++) {
		writeVirtualMem(args[0] + i - 1, args[i]);
	}
}

function commandLOCATE(args) {
	// カーソルを移動する
	let x = args[0], y = args.length > 1 ? args[1] : 0;
	if (x < 0) x = 0;
	if (x >= SCREEN_WIDTH) x = SCREEN_WIDTH - 1;
	if (y < -1) y = -1;
	if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1;
	cursorX = x;
	cursorY = y;
}
