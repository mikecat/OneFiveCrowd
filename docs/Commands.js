"use strict";

async function commandINPUT(prompt, varIdx) {
	if (cursorY < 0) {
		throw "Not match";
	}
	isExecutingInput = true;
	try {
		await putString(prompt);
		const startX = cursorX, startY = cursorY;
		for (;;) {
			pollBreak();
			const key = dequeueKey();
			if (uartInputEchoToScreen) {
				if (key === OVERWRITE_TOGGLE_CHAR) {
					isOverwriteMode = !isOverwriteMode;
				} else if (key === ROMAN_TOGGLE_CHAR) {
					isRomanMode = !isRomanMode;
				}
			}
			switch (key) {
				case -1:
					// 入力されていない
					updateScreen();
					await new Promise(function(resolve, reject) {
						inputKeyBlockCallback = function() {
							inputKeyBlockCallback = null;
							resolve();
						};
						keyBlocked = true;
					});
					break;
				case 0x08:
					// Backspace
					if (cursorX !== startX) await putString("\x08", false, true);
					break;
				case 0x0a:
					// Enter
					{
						const addr = VRAM_ADDR + SCREEN_WIDTH * startY + startX;
						let exprStr = "";
						for (let i = addr; i < ramBytes.length && ramBytes[i] !== 0; i++) {
							exprStr += String.fromCharCode(ramBytes[i]);
						}
						const tokens = lexer(exprStr, VIRTUAL_RAM_OFFSET + addr);
						// エラーが出たら最後のトークンを削ってリトライする
						// たとえば、100/0 が入力されたとき 100 を格納するのに有効
						while (tokens.length > 0) {
							const ast = parser.parseExpr(tokens, true);
							if (ast !== null) {
								const executable = compiler.compileExpr(ast);
								try {
									const ret = await executable();
									writeArray(varIdx, ret);
									await putString("\n");
									return;
								} catch(e) {
								}
							}
							tokens.pop();
						}
						// 何も有効な入力が無かった場合、0 を格納する
						writeArray(varIdx, 0);
						await putString("\n");
						return;
					}
					break;
				case 0x1c:
					// カーソルを左に移動
					if (cursorX !== startX) await putString("\x1c", false, true);
					break;
				case 0x1e:
					// カーソルを上に移動
					// 無視
					break;
				case 0x1f:
					// カーソルを下に移動
					// 無視
					break;
				default:
					await putString(String.fromCharCode(key), false, true);
					break;
			}
		}
	} finally {
		isExecutingInput = false;
	}
}

async function commandLED(args) {
	// LEDの点灯/消灯を切り替える
	await ioManager.setPortStatus({
		"id": "led",
		"status": "output_binary",
		"binaryValue": args[0] !== 0 ? 1 : 0,
	});
}

async function commandWAIT(args) {
	// 指定した時間待機する
	let timeToWait = Math.abs(args[0]) * 1000 / (TICK_PER_SECOND * (args[0] < 0 ? TICK_HIRES_MULT : 1));
	let startTime = performance.now();
	if (timeToWait >= 15) updateScreen();
	for (;;) {
		pollBreak();
		if (timeToWait < 10){
			while (performance.now() - startTime < timeToWait);
			return null;
		} else if (timeToWait <= 200) {
			return new Promise(function(resolve, reject) {
				setTimeout(function() { resolve(null); }, timeToWait);
			});
		} else {
			await new Promise(function(resolve, reject) {
				setTimeout(function() { resolve(null); }, 200);
			});
			const currentTime = performance.now();
			timeToWait -= currentTime - startTime;
			startTime = currentTime;
		}
	}
}

function commandKBD(args) {
	// キーボード配列を変更する
	keyLayout = args[0] === 0 ? 0 : 1;
	switchScreenKeys(keyLayout);
	writeLocalStorage("keyLayout", keyLayout);
	setSelectByValue(document.getElementById("systemKeyboardLayoutSelect"), keyLayout);
}

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

async function commandLIST(args) {
	// メモリ上のプログラムを出力する
	let showMin, showMax;
	if (args.length === 0) {
		showMin = LINE_NUMBER_MIN;
		showMax = LIST_DEFAULT_SHOW_MAX;
	} else if (args.length === 1) {
		if (args[0] < 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = -args[0];
		} else if (args[0] === 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = LIST_DEFAULT_SHOW_MAX;
		} else {
			showMin = args[0];
			showMax = args[0];
		}
	} else {
		if (args[0] > 0 && args[1] > 0) {
			showMin = args[0];
			showMax = args[1];
		} else if (args[0] < 0 && args[1] < 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = LINE_NUMBER_MAX;
		} else if (args[0] < 0 && args[1] > 0) {
			showMin = LINE_NUMBER_MIN;
			showMax = args[1];
		} else if (args[0] > 0 && args[1] < 0) {
			showMin = args[0];
			showMax = LINE_NUMBER_MAX;
		} else if (args[0] === 0) {
			if (args[1] > 0) {
				showMin = LINE_NUMBER_MIN;
				showMax = args[1];
			} else if (args[1] < 0) {
				showMin = LINE_NUMBER_MIN;
				showMax = LINE_NUMBER_MAX;
			} else { // args[1] === 0
				showMin = LINE_NUMBER_MIN;
				showMax = LIST_DEFAULT_SHOW_MAX;
			}
		} else { // args[1] === 0
			if (args[0] > 0) {
				showMin = args[0];
				showMax = args[0] <= LIST_DEFAULT_SHOW_MAX ? LIST_DEFAULT_SHOW_MAX : LINE_NUMBER_MAX;
			} else { // args[0] < 0
				showMin = LINE_NUMBER_MIN;
				showMax = LINE_NUMBER_MAX;
			}
		}
	}
	let ptr = 0;
	let shownCount = 0;
	while (ptr + 3 <= prgView.length) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		if (lineNo === 0) break;
		const lineLength = prgView[ptr + 2];
		if (showMin <= lineNo && lineNo <= showMax && ptr + 3 + lineLength <= prgView.length) {
			let line = "" + lineNo + " ";
			for (let i = 0; i < lineLength && prgView[ptr + 3 + i] !== 0; i++) {
				line += String.fromCharCode(prgView[ptr + 3 + i]);
			}
			const shownCountDelta = 1 + Math.floor(line.length / SCREEN_WIDTH);
			if (shownCount + shownCountDelta > SCREEN_HEIGHT - 2) {
				await commandWAIT([LIST_WAIT_TIME]);
				shownCount = 0;
			}
			shownCount += shownCountDelta;
			await putString(line + "\n");
		}
		ptr += lineLength + 4;
	}
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

async function commandLOCATE(args) {
	// カーソルを移動する
	let x, y;
	if (args.length < 2) {
		x = args[0] % SCREEN_WIDTH;
		y = ~~(args[0] / SCREEN_WIDTH);
	} else {
		x = args[0];
		y = args[1];
	}
	if (args.length >= 3) {
		forceShowCursor = args[2] !== 0;
	}
	if (x < 0) x = 0;
	if (x >= SCREEN_WIDTH) x = SCREEN_WIDTH - 1;
	if (y < -1) y = -1;
	if (y >= SCREEN_HEIGHT) y = SCREEN_HEIGHT - 1;
	cursorX = x;
	cursorY = y;
	await sendToUart({"command": "LOCATE", "x": x, "y": y});
}

async function commandCLS() {
	clearScreen();
	await sendToUart({"command": "CLS"});
}

async function commandSAVE(args) {
	// プログラム領域のデータを保存する
	const slot = args.length > 0 ? args[0] : functionFILE();
	lastFileNo = slot & 0xFF;
	if (await saveFile(slot)) {
		await putString("Saved " + (1024 - functionFREE()) + "byte\n");
	} else {
		throw "File error";
	}
}

async function commandLOAD(args) {
	// プログラム領域にデータを読み込む
	const slot = args.length > 0 ? args[0] : functionFILE();
	lastFileNo = slot & 0xFF;
	if (await loadFile(slot)) {
		if (prgView[0] === 0xFF && prgView[1] === 0xFF) {
			throw "File error";
		} else if (prgView[1] < 0x80) {
			await putString("Loaded " + (1024 - functionFREE()) + "byte\n");
		}
	} else {
		for (let i = 0; i < prgView.length; i++) {
			prgView[i] = 0;
		}
		prgDirty = true;
		throw "File error";
	}
	return [-1, 0];
}

async function commandFILES(args) {
	// ファイルのタイトルリストを出力する
	const DEFAULT_LAST_NO = 14, EEPROM_START = 100, EEPROM_END = 227;
	const BREAK_AFTER_COUNT = 22;
	let startNo = 0, endNo = 0, skipAfterDefaultLast = false;
	if (args.length < 2) {
		// 終了番号のみを指定
		endNo = args.length > 0 ? args[0] : DEFAULT_LAST_NO;
		if (endNo === 0) endNo = EEPROM_END;
		skipAfterDefaultLast = true;
	} else {
		// 開始番号と終了番号を指定
		startNo = args[0];
		endNo = args[1];
	}
	let count = 0;
	for (let i = startNo; i <= endNo;) {
		const title = await getFileTitle(i);
		let stringToPrint = "" + i;
		if (title !== "") stringToPrint += " " + title;
		await putString(stringToPrint.substring(0, SCREEN_WIDTH - 2) + "\n");
		if (++count >= SCREEN_HEIGHT - 2) {
			await commandWAIT([60]);
			count = 0;
		}
		if (i === DEFAULT_LAST_NO && skipAfterDefaultLast) {
			i = EEPROM_START;
		} else {
			i++;
		}
	}
}

async function commandBEEP(args) {
	// ビープ音を出す
	const kind = args.length > 0 ? args[0] : 10;
	const length = args.length > 1 ? args[1] : 3;
	const lengthMs = length <= 0 ? -1 : 1000 * length / 60;
	if (kind === 0) {
		await soundManager.stop();
	} else {
		const trueKind = kind < 0 ? kind + 65536 : kind;
		await soundManager.beep(8000 / trueKind, lengthMs);
	}
}

async function commandPLAY(args) {
	// MMLを再生する
	if (args.length > 0) {
		let mml = "";
		for (let addr = args[0]; ; addr++) {
			const c = readVirtualMem(addr);
			if (c === 0 || c === 0x22) break;
			mml += String.fromCharCode(c);
		}
		await soundManager.play(mml, document.getElementById("systemMMLInterpretationSelect").value === "old");
	} else {
		await soundManager.stop();
	}
}

async function commandTEMPO(args) {
	// 再生中の音楽のテンポを変更する
	await soundManager.setTempo(args[0]);
}

async function commandSCROLL(args) {
	// 画面をスクロールする
	switch (args[0]) {
		case 0: case 30: // 上
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				for (let y = 0; y < SCREEN_HEIGHT - 1; y++) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * (y + 1) + x];
				}
				vramView[SCREEN_WIDTH * (SCREEN_HEIGHT - 1) + x] = 0;
			}
			vramDirty = true;
			await sendToUart({"command": "SCROLL", "direction": "up"});
			break;
		case 1: case 29: // 右
			for (let y = 0; y < SCREEN_HEIGHT; y++) {
				for (let x = SCREEN_WIDTH - 1; x > 0; x--) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * y + (x - 1)];
				}
				vramView[SCREEN_WIDTH * y] = 0;
			}
			vramDirty = true;
			await sendToUart({"command": "SCROLL", "direction": "right"});
			break;
		case 2: case 31: // 下
			for (let x = 0; x < SCREEN_WIDTH; x++) {
				for (let y = SCREEN_HEIGHT - 1; y > 0; y--) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * (y - 1) + x];
				}
				vramView[x] = 0;
			}
			vramDirty = true;
			await sendToUart({"command": "SCROLL", "direction": "down"});
			break;
		case 3: case 28: // 左
			for (let y = 0; y < SCREEN_HEIGHT; y++) {
				for (let x = 0; x < SCREEN_WIDTH - 1; x++) {
					vramView[SCREEN_WIDTH * y + x] = vramView[SCREEN_WIDTH * y + (x + 1)];
				}
				vramView[SCREEN_WIDTH * y + (SCREEN_WIDTH - 1)] = 0;
			}
			vramDirty = true;
			await sendToUart({"command": "SCROLL", "direction": "left"});
			break;
	}
}

function commandNEXT(args, nextPos) {
	// 対応するFORの処理に飛ぶ
	if (forStack.length === 0) throw "Not match";
	const destination = forStack[forStack.length - 1];
	forStack.push(nextPos);
	return destination;
}

function commandGOSUB(args, nextPos) {
	// 戻る場所を記録して指定の行に飛ぶ
	if (prgDirty) compileProgram();
	if (args[0] > 0 && (args[0] in programs)) {
		gosubStack.push(nextPos);
		return [args[0], 0];
	} else {
		throw "Line error";
	}
}

function commandRETURN() {
	// 記録した場所に戻る
	if (gosubStack.length === 0) throw "Not match";
	return gosubStack.pop();
}

function commandSTOP() {
	// プログラムの実行を止める
	throw "Stopped";
}

function commandCONT() {
	// 前回エラーが出た行からプログラムを実行する (インタラクティブ時)
	// 現在の行の先頭から実行する (保存したプログラムの実行時)
	if (currentLine <= 0) {
		if (prgDirty) compileProgram();
		if (lastErrorLine in programs) {
			return [lastErrorLine, 0];
		} else {
			throw "Line error";
		}
	} else {
		return [currentLine, 0];
	}
}

function commandRENUM(args) {
	// プログラム領域のプログラムの行番号を振り直す
	const start = args.length > 0 ? args[0] : 10;
	const delta = args.length > 1 ? args[1] : 10;
	if (start <= 0 || delta <= 0) throw "Illegal argument";
	// プログラム領域から行番号のリストを取得する
	const lineNoList = [];
	let ptr = 0;
	while (ptr + 3 <= prgView.length) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		if (lineNo === 0) break;
		const lineLength = prgView[ptr + 2];
		lineNoList.push(lineNo);
		ptr += lineLength + 4;
	}
	// 取得した行番号のリストを昇順にソートし、重複した行番号を取り除く
	lineNoList.sort(function(a, b) { return a < b ? -1 : (a > b ? 1 : 0); });
	for (let i = 1; i < lineNoList.length; i++) {
		if (lineNoList[i - 1] === lineNoList[i]) {
			lineNoList.splice(i, 1);
			i--;
		}
	}
	// 新しい行番号を求める
	// 存在する行番号の場合 → その行番号に対応する行番号
	// 存在しない行番号の場合 → 次の存在する行番号に対応する行番号 or (前の存在する行番号に対応する行番号 + 増分)
	const getNewLineNo = function(oldLineNo) {
		// 行番号がない or 最初の存在する行番号の前
		if (lineNoList.length === 0 || oldLineNo <= lineNoList[0]) return start;
		// 最後の存在する行番号の後ろ
		if (lineNoList[lineNoList.length - 1] < oldLineNo) return start + delta * lineNoList.length;
		// めぐる式二分探索で、クエリの行番号以降で最初の存在する行番号を求める
		let less = 0, ge = lineNoList.length - 1;
		while (less + 1 < ge) {
			let m = less + Math.floor((ge - less) / 2);
			if (lineNoList[m] < oldLineNo) less = m; else ge = m;
		}
		// 求めた行番号に対応する新しい行番号
		return start + delta * ge;
	};
	// 行番号を振り直す
	let lineCount = 0;
	ptr = 0;
	while (ptr + 3 <= prgView.length) {
		const lineNo = prgView[ptr] | (prgView[ptr + 1] << 8);
		if (lineNo === 0) break;
		const newLineNoForThisLine = start + delta * lineCount;
		prgView[ptr] = newLineNoForThisLine & 0xff;
		prgView[ptr + 1] = (newLineNoForThisLine >> 8) & 0xff;
		lineCount++;
		const lineLength = prgView[ptr + 2];
		const prgOffset = ptr + 3;
		const trueLineLength = prgOffset + lineLength <= prgView.length ? lineLength : prgView.length - prgOffset;
		let startPos = -1, status = 0, inString = false;
		for (let i = 0; i < trueLineLength; i++) {
			let c = String.fromCharCode(prgView[prgOffset + i]).toUpperCase();
			// 文字列の中は対象外
			if (inString) {
				if (c === "\"") {
					inString = false;
					status = 0;
				}
				continue;
			}
			if (c === "\"") {
				inString = true;
				continue;
			}
			// コメントは対象外
			if (c === "'") {
				break;
			}
			switch (status) {
				case 0:
					// 後で処理する
					break;
				case 10: // G
					if (c === "O") {
						status = 20;
					} else if (c === "S") {
						status = 21;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 20: // GO
					if (c === "T") {
						status = 30;
					} else if (c === "S") {
						status = 31;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 21: // GS
					if (c === "B") {
						status = 100;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 30: // GOT
					if (c === "O") {
						status = 100;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 31: // GOS
					if (c === "U") {
						status = 40;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 40: // GOSU
					if (c === "B") {
						status = 100;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 1000: // R
					if (c === "E") {
						status = 1010;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				case 1010: // RE
					if (c === "M") {
						status = 2000;
					} else if (c !== " ") {
						status = 0;
					}
					break;
				default:
					throw "RENUM internal error (bug)";
			}
			// コメント (REM) は対象外
			if (status === 2000) {
				break;
			}
			// GOGOTO などのケースに対処するため、1文字目はここで処理する
			if (status === 0) {
				if (c === "G") {
					startPos = i;
					status = 10;
				} else if (c === "R") {
					status = 1000;
				}
			}
			if (status === 100) {
				status = 0;
				let numberStart = -1;
				let oldLineNumber = 0;
				for (i++; i < trueLineLength; i++) {
					const c = prgView[prgOffset + i];
					if (0x30 <= c && c <= 0x39) {
						if (numberStart < 0) numberStart = i;
						oldLineNumber = oldLineNumber * 10 + (c - 0x30);
					} else if (c !== 0x20) {
						break;
					}
				}
				// 数字と空白以外が現れる前に数字があった場合、行番号として書き換える
				if (numberStart >= 0) {
					// startPos : GOTO/GOSUB/GSB の1文字目のGの位置
					// numberStart : GOTO/GOSUB/GSB に続く数字の1文字目の位置
					// i : GOTO/GOSUB/GSBの後の数字の後の数字と空白以外の最初の文字の位置

					// まず、[numberStart, i) の範囲に新しい行番号を書き込もうとする
					// 文字数が足りない場合で、行の文字数が奇数の場合、1文字後ろにずらす
					// [numberStart, i) の範囲が余った場合は、空白で埋める
					// 足りない場合は、最大 [startPos + 1, i) を用い、それでも足りない場合は上位桁を捨てる
					const newLineNumber = "" + getNewLineNo(oldLineNumber);
					if (i - numberStart < newLineNumber.length && prgView[prgOffset + trueLineLength - 1] === 0) {
						// 文字数が足りず、行の文字数が奇数 (最終バイトがゼロ) → 1文字後ろにずらす
						for (let j = trueLineLength - 1; j > i; j--) {
							prgView[prgOffset + j] = prgView[prgOffset + j - 1];
						}
						i++;
					}
					let j = i - 1;
					for (let count = 0; count < newLineNumber.length && j > startPos; count++) {
						prgView[prgOffset + j] = newLineNumber.charCodeAt(newLineNumber.length - 1 - count);
						j--;
					}
					for (; j >= numberStart; j--) {
						prgView[prgOffset + j] = 0x20;
					}
				}
				// i は今回処理した範囲の次の位置を指しているので、ループの i++ と打ち消す
				i--;
			}
		}
		ptr += lineLength + 4;
	}
}

async function commandLRUN(args) {
	// プログラム領域にデータを読み込み、実行する
	const slot = args.length > 0 ? args[0] : functionFILE();
	lastFileNo = slot & 0xFF;
	if (await loadFile(slot)) {
		if (prgView[0] === 0xFF && prgView[1] === 0xFF) {
			throw "File error";
		}
		if (args.length < 2 || args[1] === 0) {
			return commandRUN();
		} else if (args[1] < 0 || 0x8000 <= args[1]) {
			throw "Line error";
		} else {
			return [args[1], 0];
		}
	} else {
		for (let i = 0; i < prgView.length; i++) {
			prgView[i] = 0;
		}
		prgDirty = true;
		throw "File error";
	}
}

async function commandSLEEP() {
	// ボタンが離されている状態から押されるまで待機し、プログラム0を実行する
	// ボタンが離されるまで待機する
	for (;;) {
		const status = await ioManager.queryIn(["btn"], false);
		if (status.btn) break;
		await new Promise(function(resolve, reject) {
			setTimeout(resolve, 10);
		});
	}
	// 入出力ポートを全てHi-Z (プルアップなし入力) にする
	const portIDs = ["in1", "in2", "in3", "in4", "out1", "out2", "out3", "out4", "out5", "out6", "btn", "led"];
	const portCommand = portIDs.map((id) => ({"id": id, "status": "input"}));
	await ioManager.setPortStatus(portCommand);
	// 画面出力を切る
	mainScreen.classList.add("disabled");
	// ボタンが押されるまで待機する
	for (;;) {
		const status = await ioManager.queryIn(["btn"], false);
		if (status.btn === 0) break;
		await new Promise(function(resolve, reject) {
			setTimeout(resolve, 10);
		});
	}
	// リセットし、プログラム0を実行する
	await resetSystem();
	return commandLRUN([0]);
}

function commandVIDEO(args) {
	// 画面の表示設定を変更する
	const config = args[0];
	if (config < 0) {
		// 本家では動作異常を起こすが、無視する
	} else if (config === 0) {
		// 非表示
		screenArea.classList.add("mainDisabled");
	} else {
		const newVideoZoom = config <= 8 ? 1 << ((config - 1) >>> 1) : 8;
		const newVideoInvert = (config & 1) === 0;
		if (videoInvert !== newVideoInvert) videoConfigUpdated = true;
		if (!lcdMode) {
			SCREEN_WIDTH = RAW_SCREEN_WIDTH / newVideoZoom;
			SCREEN_HEIGHT = RAW_SCREEN_HEIGHT / newVideoZoom;
		}
		if (newVideoZoom !== videoZoom) commandCLS();
		videoZoom = newVideoZoom;
		videoInvert = newVideoInvert;
		screenArea.classList.remove("mainDisabled");
		if (videoInvert) {
			screenArea.classList.add("mainInvert");
		} else {
			screenArea.classList.remove("mainInvert");
		}
	}
	// TODO: クロックダウン設定の反映
}

function commandPOKE(args) {
	// 仮想メモリにデータを書き込む
	for (let i = 1; i < args.length; i++) {
		writeVirtualMem(args[0] + i - 1, args[i]);
	}
}

async function commandHELP() {
	// メモリマップを出力する
	await putString("#000 CHAR\n");
	await putString("#" + (VIRTUAL_RAM_OFFSET + CRAM_ADDR).toString(16).toUpperCase() + " PCG\n");
	await putString("#" + (VIRTUAL_RAM_OFFSET + ARRAY_ADDR).toString(16).toUpperCase() + " VAR\n");
	await putString("#" + (VIRTUAL_RAM_OFFSET + VRAM_ADDR).toString(16).toUpperCase() + " VRAM\n");
	if (cakeMode) {
		await putString("#" + (VIRTUAL_RAM_OFFSET + ARRAY2_ADDR_CAKE).toString(16).toUpperCase() + " VAR2\n");
	}
	await putString("#" + (VIRTUAL_RAM_OFFSET + PRG_ADDR).toString(16).toUpperCase() + " LIST\n");
}

async function commandRESET() {
	// システムをリセットする
	await resetSystem();
	return [currentLine, currentPositionInLine];
}

const outPorts = [
	"out1", "out2", "out3", "out4", "out5", "out6", "led", "in1", "in2", "in3", "in4",
];

async function commandOUT(args) {
	// I/Oポートの出力を設定する
	if (args.length === 1 || args[0] === 0) {
		const bits = args.length === 1 ? args[0] : args[1];
		const query = [];
		const portStatus = ioManager.getPortStatus();
		for (let i = 0; i < outPorts.length; i++) {
			if (portStatus[outPorts[i]].status === "output_binary") {
				query.push({
					"id": outPorts[i],
					"status": "output_binary",
					"binaryValue": (bits >> i) & 1,
				});
			}
		}
		if (query.length > 0) {
			await ioManager.setPortStatus(query);
		}
	} else if (1 <= args[0] && args[0] <= outPorts.length) {
		const portId = outPorts[args[0] - 1];
		if (args[1] < 0 && portId !== "led") {
			await ioManager.setPortStatus({
				"id": portId,
				"status": args[1] === -2 ? "input_pullup" : "input",
			});
		} else if (args[1] >= 0) {
			await ioManager.setPortStatus({
				"id": portId,
				"status": "output_binary",
				"binaryValue": args[1] === 0 ? 0 : 1,
			});
		}
	}
}

async function commandPWM(args) {
	if (1 <= args[0] && args[0] <= outPorts.length) {
		await ioManager.setPortStatus({
			"id": outPorts[args[0] - 1],
			"status": "output_pwm",
			"pwmValue": args[1],
			"pwmPeriod": args.length > 2 ? args[2] : 2000,
		});
	}
}

async function commandDAC(args) {
	if (1 <= args[0] && args[0] <= outPorts.length) {
		await ioManager.setPortStatus({
			"id": outPorts[args[0] - 1],
			"status": "output_analog",
			"analogValue": args[1] < 0 ? 0 : (args[1] > 1023 ? 1023 : args[1]),
		});
	}
}

async function commandBPS(args) {
	const uartSpeed = args[0];
	const i2cSpeed = args.length > 1 ? args[1] : 400;
	await uartManager.setBps((function() {
		switch (uartSpeed) {
			case 0: return 115200;
			case -1: return 57600;
			case -2: return 38400;
			default:
				if (uartSpeed < 0) return -uartSpeed * 100;
				else return uartSpeed;
		}
	})());
	i2cManager.setSpeedBps((function() {
		if (i2cSpeed === 0) return 400000;
		else if (i2cSpeed < 0) return 366;
		else return i2cSpeed * 1000;
	})());
}

function commandSRND(args) {
	// 乱数の種を設定する
	randomSeeded = true;
	seededX = args[0];
	seededY = 362436069;
	seededZ = 521288629;
	seededW = 88675123;
}

function commandCOPY(args) {
	// 仮想メモリ中のデータのコピーを行う
	const dest = args[0], src = args[1], amount = args[2];
	if (amount >= 0) {
		for (let i = 0; i < amount; i++) {
			writeVirtualMem(dest + i, readVirtualMem(src + i));
		}
	} else {
		for (let i = 0; i > amount; i--) {
			writeVirtualMem(dest + i, readVirtualMem(src + i));
		}
	}
}

function commandUART(args) {
	// シリアルポートの入出力設定を行う
	const outputConfig = args[0] & 0xf;
	const inputConfig = args.length > 1 ? args[1] : 1;
	// 出力設定
	uartPrintToScreen = (outputConfig & 8) === 0;
	uartPrintToSerial = (outputConfig & 3) !== 0;
	uartPrintControl = (outputConfig & 3) === 2;
	uartEchoback = (outputConfig & 4) !== 0;
	uartOutputCrlf = (outputConfig & 3) === 3;
	uartInputEchoToScreen = outputConfig < 12;
	uartInputEchoToSerial = uartEchoback && uartPrintToSerial;
	// 入力設定
	uartNoInput = inputConfig === 0;
	uartNoStopOnEsc = (inputConfig & 2) !== 0;
	uartInputCrAsLf = (inputConfig & 4) !== 0;
}

function commandOK(args) {
	// メッセージの表示モードを設定する
	okMode = args.length > 0 ? args[0] : 1;
}

async function commandIoT_OUT(args) {
	// IoTモジュールにデータを送信する
	if (args.length === 1) {
		// 4バイト即時送信
		const sendData = new Uint8Array(13);
		sendData[0] = 0x21;
		sendData[1] = 0x0a;
		sendData[2] = 0x00;
		sendData[3] = 0x69;
		sendData[4] = args[0] & 0xff;
		sendData[5] = (args[0] >> 8) & 0xff;
		sendData[6] = sendData[7] = args[0] & 0x8000 ? 0xff : 0;
		sendData[12] = 0;
		for (let i = 0; i < 12; i++) sendData[12] ^= sendData[i];
		const sendRes = await i2cManager.performI2C(0x4f, sendData, 0);
		if (sendRes === null) return;
		await i2cManager.performI2C(0x4f, new Uint8Array(0), 3);
	} else {
		// データを8バイトずつ送信キューに入れる
		const dataAddress = args[0], dataLength = args[1];
		const sendFlag = args.length > 2 ? args[2] : 1;
		if (dataLength < 0 || dataLength % 8 !== 0 || dataLength > 0x100) throw "Illegal argument";
		if (dataAddress < 0 && dataLength > 0) throw "Complex expression";
		const sendData = new Uint8Array(13);
		sendData[0] = 0x20;
		sendData[1] = 0x0a;
		sendData[2] = 0x01;
		sendData[3] = 0x62;
		for (let i = 0; i < dataLength; i += 8) {
			for (let j = 0; j < 8; j++) {
				sendData[4 + j] = readVirtualMem(dataAddress + i + j);
			}
			sendData[12] = 0;
			for (let j = 0; j < 12; j++) sendData[12] ^= sendData[j];
			const sendRes = await i2cManager.performI2C(0x4f, sendData, 0);
			if (sendRes === null) return;
		}
		// 送信キューの中身を送信する
		if (sendFlag !== 0) {
			const sendRes = await i2cManager.performI2C(0x4f, new Uint8Array([0x24, 0x00, 0x24]), 0);
			if (sendRes === null) return;
			await i2cManager.performI2C(0x4f, new Uint8Array(0), 3);
		}
	}
}

function commandSWITCH(args) {
	// ビデオモードと液晶モードを切り替える
	const newLcdMode = args.length > 0 ? args[0] !== 0 : !lcdMode;
	mainScreen.setAttribute("width", newLcdMode ? "288" : "544");
	mainScreen.setAttribute("height", newLcdMode ? "160" : "416");
	if (newLcdMode) {
		SCREEN_WIDTH = 16;
		SCREEN_HEIGHT = 8;
	} else {
		SCREEN_WIDTH = RAW_SCREEN_WIDTH / videoZoom;
		SCREEN_HEIGHT = RAW_SCREEN_HEIGHT / videoZoom;
	}
	// TODO: 液晶の濃さの設定
	lcdMode = newLcdMode;
	commandCLS();
}

function commandDRAW(args) {
	// 点または線を描画する
	// modeの仕様 (観察結果)
	// 0: 描画する位置の点を消す
	// 1: 描画する位置に点を出す
	// 2: 描画する位置の点をトグルする (#80台以外は点が無い扱い)
	// 3: 何もしない
	// その他？: 描画する位置の点は変更せず、#80台以外なら#80にする
	const mode = args.length % 2 === 0 ? 1 : args[args.length - 1];
	const drawPoint = function(x, y) {
		if(x < 0 || SCREEN_WIDTH * 2 <= x || y < 0 || SCREEN_HEIGHT * 2 <= y) return;
		if(mode === 3) return;
		const idx = SCREEN_WIDTH * (y >> 1) + (x >> 1);
		const offset = 2 * (y & 1) + (x & 1);
		if ((vramView[idx] & 0xf0) !== 0x80) vramView[idx] = 0x80;
		switch (mode) {
			case 0: vramView[idx] &= ~(1 << offset); break;
			case 1: vramView[idx] |= 1 << offset; break;
			case 2: vramView[idx] ^= 1 << offset; break;
		}
		vramDirty = true;
	};
	const sx = args[0], sy = args[1];
	const dx = args.length >= 4 ? args[2] : args[0];
	const dy = args.length >= 4 ? args[3] : args[1];
	const alg = document.getElementById("systemDrawAlgorithmSelect").value;
	if (alg === "bresenham") {
		// ブレゼンハムのアルゴリズム
		const wx = sx >= dx ? sx - dx : dx - sx, wy = sy >= dy ? sy - dy : dy - sy;
		const xmode = wx >= wy;
		let x = sx, y = sy, gosa = 0;
		while (x !== dx || y !== dy) {
			drawPoint(x, y);
			if (xmode) {
				if (sx < dx) x++; else x--;
				gosa += (dy - sy) << 1;
				if (gosa > wx){
					y++;
					gosa -= wx << 1;
				} else if (gosa < -wx) {
					y--;
					gosa += wx << 1;
				}
			} else {
				if (sy < dy) y++; else y--;
				gosa += (dx - sx) << 1;
				if (gosa > wy) {
					x++;
					gosa -= wy << 1;
				} else if (gosa < -wy) {
					x--;
					gosa += wy << 1;
				}
			}
		}
		drawPoint(x, y);
	} else {
		// 線形補間
		if (sx === dx && sy === dy) {
			drawPoint(sx, sy);
		} else if (Math.abs(sx - dx) >= Math.abs(sy - dy)) {
			if (sx <= dx) {
				for (let x = sx; x <= dx; x++) {
					drawPoint(x, sy + Math.trunc((dy - sy) * (x - sx) / (dx - sx)));
				}
			} else {
				for (let x = dx; x <= sx; x++) {
					drawPoint(x, dy + Math.trunc((sy - dy) * (x - dx) / (sx - dx)));
				}
			}
		} else {
			if (sy <= dy) {
				for (let y = sy; y <= dy; y++) {
					drawPoint(sx + Math.trunc((dx - sx) * (y - sy) / (dy - sy)), y);
				}
			} else {
				for (let y = dy; y <= sy; y++) {
					drawPoint(dx + Math.trunc((sx - dx) * (y - dy) / (sy - dy)), y);
				}
			}
		}
	}
}

async function commandWS_LED(args) {
	// フルカラーLED用の色情報を送信する
	const numLED = args[0], numRepeat = args.length > 1 ? args[1] : 1;
	if (numLED <= 0 || numRepeat <= 0 || numLED * 3 > ARRAY_SIZE) return;
	const colorData = [];
	for (let i = 0; i < numLED; i++) {
		colorData.push([readArray(i * 3 + 0) & 0xff, readArray(i * 3 + 1) & 0xff, readArray(i * 3 + 2) & 0xff]);
	}
	await wsLedManager.sendColors(colorData, numRepeat, ["led"]);
}

async function commandSEC_PUBKEY(args) {
	// Ed25519の秘密鍵から公開鍵を求める
	// args[0] : 公開鍵(出力)の仮想アドレス
	// args[1] : 秘密鍵(入力)の仮想アドレス
	const privateKey = new Uint8Array(32);
	for (let i = 0; i < 32; i++) privateKey[i] = readVirtualMem(args[1] + i);
	const publicKey = new Uint8Array(await ed25519.getPublicKey(privateKey));
	for (let i = 0; i < 32; i++) writeVirtualMem(args[0] + i, publicKey[i]);
}

async function commandSEC_SIGN(args) {
	// Ed25519の署名を生成する
	// args[0] : 署名(出力)の仮想アドレス
	// args[1] : 秘密鍵(入力)の仮想アドレス
	// args[2] : メッセージ(入力)の仮想アドレス
	// args[3] : メッセージ(入力)の長さ (0未満の場合は0とみなす)
	const privateKey = new Uint8Array(32);
	for (let i = 0; i < 32; i++) privateKey[i] = readVirtualMem(args[1] + i);
	const message = new Uint8Array(args[3] < 0 ? 0 : args[3]);
	for (let i = 0; i < args[3]; i++) message[i] = readVirtualMem(args[2] + i);
	const sign = new Uint8Array(await ed25519.sign(message, privateKey));
	for (let i = 0; i < 64; i++) writeVirtualMem(args[0] + i, sign[i]);
}

async function commandPC_CLEAR(args) {
	// PanCakeのCLEARに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x00" + String.fromCharCode(args[0] & 0xff));
}

async function commandPC_LINE(args) {
	// PanCakeのLINEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x08\x01" + String.fromCharCode(
		args[0] & 0xff, args[1] & 0xff, args[2] & 0xff, args[3] & 0xff, args[4] & 0xff
	));
}

async function commandPC_STAMP(args) {
	// PanCakeのSTAMPに相当するバイナリコマンドをUARTで送信する
	let data = "\x80\x26\x02" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff, args[2] & 0xff);
	let eos = false;
	let address = args[3];
	let cbuf = 0;
	for (let i = 0; i < 64; i++) {
		const c_raw = eos ? 0 : readVirtualMem(address++);
		if (c_raw === 0 || c_raw === 0x22) eos = true;
		const c = eos ? 0 : c_raw;
		const c_int_raw = parseInt(c, 16);
		const c_int = isNaN(c_int_raw) ? 0 : c_int_raw;
		if (i % 2 === 0) {
			cbuf = c_int;
		} else {
			data += String.fromCharCode((cbuf << 4) | c_int);
		}
	}
	await sendToUart(data);
}

async function commandPC_STAMP1(args) {
	// PanCakeのSTAMP1に相当するバイナリコマンドをUARTで送信する
	let data = "\x80\x0E\x03" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff, args[2] & 0xff);
	let eos = false;
	let address = args[3];
	let cbuf = 0;
	for (let i = 0; i < 16; i++) {
		const c_raw = eos ? 0 : readVirtualMem(address++);
		if (c_raw === 0 || c_raw === 0x22) eos = true;
		const c = eos ? 0 : c_raw;
		const c_int_raw = parseInt(c, 16);
		const c_int = isNaN(c_int_raw) ? 0 : c_int_raw;
		if (i % 2 === 0) {
			cbuf = c_int;
		} else {
			data += String.fromCharCode((cbuf << 4) | c_int);
		}
	}
	await sendToUart(data);
}

async function commandPC_IMAGE(args) {
	// PanCakeのIMAGEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x04" + String.fromCharCode(args[0] & 0xff));
}

async function commandPC_VIDEO(args) {
	// PanCakeのVIDEOに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x05" + String.fromCharCode(args[0] & 0xff));
}

async function commandPC_SSTART(args) {
	// PanCakeのSPRITE STARTに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x06" + String.fromCharCode(args[0] & 0xff));
}

async function commandPC_SCREATE(args) {
	// PanCakeのSPRITE CREATEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x05\x07" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff));
}

async function commandPC_SMOVE(args) {
	// PanCakeのSPRITE MOVEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x06\x08" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff, args[2] & 0xff));
}

async function commandPC_SOUND(args) {
	// PanCakeのSOUNDに相当するバイナリコマンドをUARTで送信する
	let data = "\x80\x0B\x09";
	for (let i = 0; i < 8; i++) {
		data += String.fromCharCode(args[i] & 0xff);
	}
	await sendToUart(data);
}

async function commandPC_SOUND1(args) {
	// PanCakeのSOUND1に相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x06\x0A" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff, args[2] & 0xff));
}

async function commandPC_MSCORE(args) {
	// PanCakeのMUSIC SCOREに相当するテキストコマンドをUARTで送信する
	const ch = args[0] & 0xff, playFlag = args[1] & 0xff, options = args[2] & 0xff;
	let mml = "";
	let mmlAddress = args[3];
	for (;;) {
		const c = readVirtualMem(mmlAddress++);
		if (c === 0 || c === 0x22) break;
		mml += String.fromCharCode(c);
	}
	const argString = [ch, playFlag, options].map(function(value) {
		const res = value.toString(16).toUpperCase();
		if (res.length >= 2) return res;
		return "0" + res;
	}).join(" ");
	await sendToUart("PC MUSIC SCORE " + argString + " " + mml + "\n");
}

async function commandPC_MPLAY(args) {
	// PanCakeのMUSIC PLAYに相当するバイナリコマンドをUARTで送信する
	if (args.length >= 2) {
		await sendToUart("\x80\x05\x0C" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff));
	} else {
		await sendToUart("\x80\x04\x0C" + String.fromCharCode(args[0] & 0xff));
	}
}

async function commandPC_RESET(args) {
	// PanCakeのRESETに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x03\x0D");
}

async function commandPC_CIRCLE(args) {
	// PanCakeのCIRCLEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x07\x0E" + String.fromCharCode(
		args[0] & 0xff, args[1] & 0xff, args[2] & 0xff, args[3] & 0xff
	));
}

async function commandPC_OUT(args) {
	// PanCakeのOUTに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x0F" + String.fromCharCode(args[0] & 0xff));
}

async function commandPC_SFLIP(args) {
	// PanCakeのSPRITE FLIPに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x05\x10" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff));
}

async function commandPC_SROTATE(args) {
	// PanCakeのSPRITE ROTATEに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x05\x11" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff));
}

async function commandPC_SUSER(args) {
	// PanCakeのSPRITE USERに相当するバイナリコマンドをUARTで送信する
	let data = "\x80\x25\x12" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff);
	let eos = false;
	let address = args[2];
	let cbuf = 0;
	for (let i = 0; i < 64; i++) {
		const c_raw = eos ? 0 : readVirtualMem(address++);
		if (c_raw === 0 || c_raw === 0x22) eos = true;
		const c = eos ? 0 : c_raw;
		const c_int_raw = parseInt(c, 16);
		const c_int = isNaN(c_int_raw) ? 0 : c_int_raw;
		if (i % 2 === 0) {
			cbuf = c_int;
		} else {
			data += String.fromCharCode((cbuf << 4) | c_int);
		}
	}
	await sendToUart(data);
}

async function commandPC_BPS(args) {
	// PanCakeのBPSに相当するバイナリコマンドをUARTで送信する
	const bps = args[0] === -1 ? 57600 : (args[0] === -2 ? 38400 : args[0] & 0xffff);
	await sendToUart("\x80\x05\x13" + String.fromCharCode(bps & 0xff, (bps >> 8) & 0xff));
}

async function commandPC_STAMPS(args) {
	// PanCakeのSTAMPSに相当するバイナリコマンドをUARTで送信する
	let data = String.fromCharCode(args[0] & 0xff, args[1] & 0xff, args[2] & 0xff);
	if (args.length >= 4) data += String.fromCharCode(args[3] & 0xff);
	if (args.length >= 5) data += String.fromCharCode(args[4] & 0xff);
	await sendToUart(String.fromCharCode(0x80, data.length + 3, 0x14) + data);
}

async function commandPC_MLOAD(args) {
	// PanCakeのMUSIC LOADに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x05\x15" + String.fromCharCode(args[0] & 0xff, args[1] & 0xff));
}

async function commandPC_WBUF(args) {
	// PanCakeのWBUFに相当するバイナリコマンドをUARTで送信する
	await sendToUart("\x80\x04\x17" + String.fromCharCode(args[0] & 0xff));
}
