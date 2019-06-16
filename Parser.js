"use strict";

const blankChars = " \t\r\n";
// トークンがあれば[トークン, トークンの次の文字の位置]を、なければnullを返す
const getTokenInfo = (function(tokens) {
	// トークンをまとめた木を構築する
	const tokenTrie = {};
	for (let i = 0; i < blankChars.length; i++) {
		tokenTrie[blankChars.charCodeAt(i)] = tokenTrie;
	}
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		let node = tokenTrie;
		for (let j = 0; j < token.length; j++) {
			const c = token.charAt(j).toLowerCase().charCodeAt(0);
			if (!(c in node)) {
				const newNode = {};
				for (let k = 0; k < blankChars.length; k++) {
					newNode[blankChars.charCodeAt(i)] = newNode;
				}
				node[c] = newNode;
				node[token.charAt(j).toUpperCase().charCodeAt(0)] = newNode;
			}
			node = node[c];
		}
		node[-1] = token;
	}
	// その木を用いてトークンを抽出する
	return function(str, start = 0) {
		let lastToken = null;
		let lastTokenIndex = -1;
		let node = tokenTrie;
		for (let i = start; i < str.length; i++) {
			if (-1 in node) {
				lastToken = node[-1];
				lastTokenIndex = i;
			}
			if (str.charCodeAt(i) in node) {
				node = node[str.charCodeAt(i)];
			} else {
				node = null;
				break;
			}
		}
		if (node && -1 in node) {
			lastToken = node[-1];
			lastTokenIndex = str.length
		}
		if (lastToken !== null) {
			return [lastToken, lastTokenIndex];
		} else {
			return null;
		}
	};
})([
	"LED", "WAIT", "RUN", "LIST", "GOTO", "END", "IF", "THEN", "ELSE", "BTN",
	"NEW", "PRINT", "LOCATE", "LC", "CLS", "RND", "SAVE", "LOAD", "FILES",
	"BEEP", "PLAY", "TEMPO", "LET", "INPUT", "TICK", "CLT", "INKEY", "CHR$",
	"ASC", "SCROLL", "SCR", "VPEEK", "==", "<>", "!=", "<=", ">=", "AND", "OR",
	"NOT", "REM", "FOR", "TO", "STEP", "NEXT", "CLV", "CLEAR", "CLK", "ABS",
	"GOSUB", "GSB", "RETURN", "RTN", "STOP", "CONT", "SOUND", "FREE", "VER",
	"RENUM", "LRUN", "FILE", "SLEEP", "VIDEO", "PEEK", "POKE", "CLP", "HELP",
	"RESET", "IN", "ANA", "OUT", "PWM", "DEC$", "HEX$", "BIN$", ">>", "<<",
	"BPS", "I2CR", "I2CW", "USR", "&&", "||", "CLO", "LANG", "LINE", "SRND",
	"COPY", "STR$", "LEN", "UART", "OK", "IoT.IN", "IoT.OUT", "SWITCH",
	":", "+", "-", "*", "/", "%", "(", ")", "=", "<", ">", ",", "[", "]", ";",
	"&", "|", "^", "~", "?", "'",
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
	"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
]);

// [トークン, トークンの次の文字の位置]を返す
const getTokenByValidChars = function(str, validChars, start = 0) {
	let token = "";
	for (let i = start; i < str.length; i++) {
		const c = str.charAt(i);
		if (blankChars.indexOf(c) >= 0) continue;
		if (validChars.indexOf(c) < 0) return [token, i];
		token += c;
	}
	return [token, str.length];
};

// トークンを[文字列, アドレス]の配列で返す
function lexer(str, firstAddr = 0) {
	const result = [];
	for (let i = 0; i < str.length;) {
		const c = str.charAt(i);
		if (blankChars.indexOf(c) >= 0) {
			// 空白文字
			i++;
		} else if (c === "#") {
			// 16進数
			const tokenInfo = getTokenByValidChars(str, "0123456789abcdefABCDEF", i + 1);
			if (tokenInfo[0] === "") {
				throw "Invalid token";
			} else {
				result.push(["#" + tokenInfo[0], firstAddr + i]);
				i = tokenInfo[1];
			}
		} else if (c === "`") {
			// 2進数
			const tokenInfo = getTokenByValidChars(str, "01", i + 1);
			if (tokenInfo[0] === "") {
				throw "Invalid token";
			} else {
				result.push(["`" + tokenInfo[0], firstAddr + i]);
				i = tokenInfo[1];
			}
		} else if ("0123456789".indexOf(c) >= 0) {
			// 10進数
			const tokenInfo = getTokenByValidChars(str, "0123456789", i);
			if (tokenInfo[0] === "") {
				throw "Invalid token";
			} else {
				result.push([tokenInfo[0], firstAddr + i]);
				i = tokenInfo[1];
			}
		} else if (c === "\"") {
			// 文字列
			const strStart = i++;
			while (i < str.length && str.charAt(i) !== "\"") i++;
			if (i < str.length) i++;
			result.push([str.substring(strStart, i), firstAddr + strStart]);
		} else if (c === "@") {
			// ラベル
			const labelStart = i++;
			const antiCharacters = blankChars + ":";
			while (i < str.length && antiCharacters.indexOf(str.charAt(i)) < 0) i++;
			result.push([str.substring(labelStart, i), firstAddr + labelStart]);
		} else {
			// その他のトークン
			const tokenInfo = getTokenInfo(str, i);
			if (tokenInfo === null) {
				throw "Invalid token";
			} else {
				result.push([tokenInfo[0], firstAddr + i]);
				i = tokenInfo[1];
				if (tokenInfo[0] === "REM" || tokenInfo[0] === "'") {
					// コメント
					result.push([str.substr(i), firstAddr + i]);
					i = str.length;
				}
			}
		}
	}
	return result;
}
