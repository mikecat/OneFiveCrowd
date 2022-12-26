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
