"use strict";

const blankChars = " ";
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
					newNode[blankChars.charCodeAt(k)] = newNode;
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
			return {"token": lastToken, "nextIndex": lastTokenIndex};
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
	"LEFT", "RIGHT", "UP", "DOWN", "SPACE", "MOD", "DRAW", "POS", "POINT",
	"COS", "SIN", "WS.LED", "KBD", "DAC",
	"SEC.PUBKEY", "SEC.SIGN", "SEC.VERIFY",
	"PC.CLEAR", "PC.LINE", "PC.STAMP", "PC.STAMP1", "PC.IMAGE",
	"PC.VIDEO", "PC.SSTART", "PC.SCREATE", "PC.SMOVE", "PC.SOUND",
	"PC.SOUND1", "PC.MSCORE", "PC.MPLAY", "PC.RESET", "PC.CIRCLE",
	"PC.OUT", "PC.SFLIP", "PC.SROTATE", "PC.SUSER", "PC.BPS",
	"PC.STAMPS", "PC.MLOAD", "PC.WBUF",
	":", "+", "-", "*", "/", "%", "(", ")", "=", "<", ">", ",", "[", "]", ";",
	"&", "|", "^", "~", "!", "?", "'",
	"A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
	"N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
]);

// トークンとトークンの次の文字の位置を返す
const getTokenByValidChars = function(str, validChars, start = 0) {
	let token = "";
	for (let i = start; i < str.length; i++) {
		const c = str.charAt(i);
		if (blankChars.indexOf(c) >= 0) continue;
		if (validChars.indexOf(c) < 0) return {"token": token, "nextIndex": i};
		token += c;
	}
	return {"token": token, "nextIndex": str.length};
};

// トークン情報の配列を返す
function lexer(str, firstAddr = 0) {
	const createTokenInfo = function(kind, token, address) {
		return {"kind": kind, "token": token, "address": address};
	};

	const result = [];
	for (let i = 0; i < str.length;) {
		const c = str.charAt(i);
		if (blankChars.indexOf(c) >= 0) {
			// 空白文字
			i++;
		} else if (c === "#") {
			// 16進数
			const tokenInfo = getTokenByValidChars(str, "0123456789abcdefABCDEF", i + 1);
			if (tokenInfo.token === "") {
				result.push(createTokenInfo("invalid", str.charAt(i), firstAddr + i));
				i++;
			} else {
				result.push(createTokenInfo("number", "#" + tokenInfo.token, firstAddr + i));
				i = tokenInfo.nextIndex;
			}
		} else if (c === "`") {
			// 2進数
			const tokenInfo = getTokenByValidChars(str, "01", i + 1);
			if (tokenInfo.token === "") {
				result.push(createTokenInfo("invalid", str.charAt(i), firstAddr + i));
				i++;
			} else {
				result.push(createTokenInfo("number", "`" + tokenInfo.token, firstAddr + i));
				i = tokenInfo.nextIndex;
			}
		} else if ("0123456789".indexOf(c) >= 0) {
			// 10進数
			const tokenInfo = getTokenByValidChars(str, "0123456789", i);
			if (tokenInfo.token === "") {
				result.push(createTokenInfo("invalid", str.charAt(i), firstAddr + i));
				i++;
			} else {
				result.push(createTokenInfo("number", tokenInfo.token, firstAddr + i));
				i = tokenInfo.nextIndex;
			}
		} else if (c === "\"") {
			// 文字列
			const strStart = i++;
			while (i < str.length && str.charAt(i) !== "\"") i++;
			if (i < str.length) i++;
			result.push(createTokenInfo("string", str.substring(strStart, i), firstAddr + strStart));
		} else if (c === "@") {
			// ラベル
			const labelStart = i++;
			const antiCharacters = blankChars + ":";
			while (i < str.length && antiCharacters.indexOf(str.charAt(i)) < 0) i++;
			result.push(createTokenInfo("label", str.substring(labelStart, i), firstAddr + labelStart));
		} else {
			// その他のトークン
			let tokenInfo = getTokenInfo(str, i);
			if (tokenInfo !== null) {
				// 1文字の変数と認識していて、前が16進数の場合、補正を試みる
				if (tokenInfo.token.length === 1 && /^[A-Z]$/i.test(tokenInfo.token) &&
				result.length > 0 && result[result.length - 1].kind === "number" && result[result.length - 1].token.charAt(0) === "#") {
					const prevTokenIdx = result[result.length - 1].address - firstAddr;
					// 16進数の最後のアルファベットの部分を遡る
					for (let j = i - 1; j > prevTokenIdx && /^[A-F ]$/i.test(str.charAt(j)); j--) {
						const tokenCandidate = getTokenInfo(str, j);
						if (tokenCandidate.token.length > 1 && tokenCandidate.nextIndex > i) {
							// 複数文字からなり、現在の位置にまでまたがるキーワードが見つかったら、採用する
							result[result.length - 1].token = str.substring(prevTokenIdx, j).replace(/ /g, "");
							tokenInfo = tokenCandidate;
							break;
						}
					}
				}
				// 登録されているキーワード
				result.push(createTokenInfo("keyword", tokenInfo.token, firstAddr + i));
				i = tokenInfo.nextIndex;
				if (tokenInfo.token === "REM" || tokenInfo.token === "'") {
					// コメント
					result.push(createTokenInfo("comment_token", str.substr(i), firstAddr + i));
					i = str.length;
				}
			} else {
				// その他(不正)
				result.push(createTokenInfo("invalid", str.charAt(i), firstAddr + i));
				i++;
			}
		}
	}
	return result;
}

const arithWrap = function(value) {
	const v1 = value & 0xffff;
	return v1 >= 0x8000 ? v1 - 0x10000 : v1;
}

/*
トークンオブジェクト
	kind : トークンの種類
		number : 数値 (2進/10進/16進)
		string : 文字列
		label : ラベル
		keyword : キーワード (コマンド、関数、演算子、変数など)
		comment_token : コメント
		invalid : その他 (不正)
	token : トークンの文字列
	address : トークンの最初の文字の論理アドレス

ASTノードオブジェクト
	kind : ノードの種類 (BNFより)
	nodes : 子ノードの配列
		子ノードはトークンオブジェクトのこともある (kindで判別)
*/

/*
              line ::= command
                     | command line_separator line
                     | if_command line
                     | comment
    line_separator ::= ":" | "ELSE"
           command ::= (空) 
                     | print_command
                     | for_command
                     | input_command
                     | let_command
                     | label_definition
                     | general_command
     print_command ::= "PRINT" print_arguments
                     | "?" print_arguments
   print_arguments ::= (空)
                     | print_argument
                     | print_argument print_separator print_arguments
    print_argument ::= string
                     | print_modifier
                     | expr
   print_separator ::= "," | ";"
    print_modifier ::= modifier_name "(" function_arguments ")"
        if_command ::= "IF" expr "THEN"
                     | "IF" expr
       for_command ::= "FOR" variable "=" expr "TO" expr
                     | "FOR" variable "=" expr "TO" expr "STEP" expr
     input_command ::= "INPUT" variable
                     | "INPUT" string "," variable
       let_command ::= "LET" variable "," argument_list
                     | variable "=" expr
  label_definition ::= label label_junk
        label_junk ::= (空)
                     | (line_separatorを除く任意のトークン) label_junk
           comment ::= "REM" comment_content
                     | "'" comment_content
   comment_content ::= (空)
                     | (任意のトークン)
   general_command ::= command_name function_arguments
function_arguments ::= (空)
                     | argument_list
     argument_list ::= expr
                     | expr "," argument_list
          variable ::= "A" | "B" | ... | "Y" | "Z"
                     | "[" expr "]"

     modifier_name ::= "CHR$" | "DEC$" | "HEX$" | "BIN$" | "STR$"
      command_name ::= "LED" | "WAIT" | "RUN" | "LIST" | "GOTO" | "END" | "NEW"
                     | "LOCATE" | "LC" | "CLS" | "SAVE" | "LOAD" | "FILES | "BEEP"
                     | "PLAY" | "TEMPO" | "CLT" | "SCROLL" | "NEXT" | "CLV"
                     | "CLEAR" | "CLK" | "GOSUB" | "GSB" | "RETURN" | "RTN"
                     | "STOP" | "CONT" | "RENUM" | "LRUN" | "SLEEP" | "VIDEO"
                     | "POKE" | "CLP" | "HELP" | "RESET" | "OUT" | "PWM" | "BPS"
                     | "CLO" | "SRND" | "COPY" | "UART" | "OK" | "IoT.OUT" | "SWITCH"
                     | "DRAW" | "WS.LED" | "KBD" | "DAC"
                     | "SEC.PUBKEY" | "SEC.SIGN"
                     | "PC.CLEAR" | "PC.LINE" | "PC.STAMP" | "PC.STAMP1" | "PC.IMAGE"
                     | "PC.VIDEO" | "PC.SSTART" | "PC.SCREATE" | "PC.SMOVE" | "PC.SOUND"
                     | "PC.SOUND1" | "PC.MSCORE" | "PC.MPLAY" | "PC.RESET" | "PC.CIRCLE"
                     | "PC.OUT" | "PC.SFLIP" | "PC.SROTATE" | "PC.SUSER" | "PC.BPS"
                     | "PC.STAMPS" | "PC.MLOAD" | "PC.WBUF"
     function_name ::= "BTN" | "TICK" | "INKEY" | "ASC" | "SCR" | "VPEEK" | "ABS"
                     | "SOUND" | "FREE" | "VER" | "FILE" | "PEEK" | "IN" | "ANA"
                     | "I2CR" | "I2CW" | "USR" | "LANG" | "LINE" | "LEN" | "IoT.IN"
                     | "RND" | "POS" | "POINT" | "COS" | "SIN"
                     | "SEC.VERIFY"
          constant ::= "LEFT | "RIGHT" | "UP" | "DOWN" | "SPACE"

              expr ::= expr7
             expr7 ::= expr6
                     | expr7 expr7_op expr6
          expr7_op ::= "OR" | "||"
             expr6 ::= expr5
                     | expr6 expr6_op expr5
          expr6_op ::= "AND" | "&&"
             expr5 ::= expr4
                     | expr5 expr5_op expr4
          expr5_op ::= "=" | "==" | "<>" | "!=" | "<" | ">" | "<=" | ">="
             expr4 ::= expr3
                     | expr4 expr4_op expr3
          expr4_op ::= "+" | "-" | "|"
             expr3 ::= expr2
                     | expr3 expr3_op expr2
          expr3_op ::= "*" | "/" | "%" | "MOD" | "<<" | ">>" | "&" | "^"
             expr2 ::= expr1
                     | expr2_op expr2
          expr2_op ::= "-" | "~" | "!" | "NOT"
             expr1 ::= "(" expr7 ")"
                     | function_name "(" function_arguments ")"
                     | constant | variable | number | label | string
*/

const variableIndice = {
	"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6,
	"H": 7, "I": 8, "J": 9, "K":10, "L":11, "M":12, "N":13,
	"O":14, "P":15, "Q":16, "R":17, "S":18, "T":19, "U":20,
	"V":21, "W":22, "X":23, "Y":24, "Z":25
};

const printModifiers = {
	"CHR$": {func: modifierCHR, minArg: 1, maxArg: 999},
	"DEC$": {func: modifierDEC, minArg: 1, maxArg: 2},
	"HEX$": {func: modifierHEX, minArg: 1, maxArg: 2},
	"BIN$": {func: modifierBIN, minArg: 1, maxArg: 2},
	"STR$": {func: modifierSTR, minArg: 1, maxArg: 2}
};

const basicCommands = {
	"LED"    : {func: commandLED, minArg: 1, maxArg: 1},
	"WAIT"   : {func: commandWAIT, minArg: 1, maxArg: 2},
	"KBD"    : {func: commandKBD, minArg: 1, maxArg: 1},
	"RUN"    : {func: commandRUN, minArg: 0, maxArg: 0},
	"LIST"   : {func: commandLIST, minArg: 0, maxArg: 2},
	"GOTO"   : {func: commandGOTO, minArg: 1, maxArg: 1},
	"END"    : {func: commandEND, minArg: 0, maxArg: 0},
	"NEW"    : {func: commandNEW, minArg: 0, maxArg: 0},
	"LOCATE" : {func: commandLOCATE, minArg: 1, maxArg: 3},
	"LC"     : {func: commandLOCATE, minArg: 1, maxArg: 3},
	"CLS"    : {func: commandCLS, minArg: 0, maxArg: 0},
	"SAVE"   : {func: commandSAVE, minArg: 0, maxArg: 1},
	"LOAD"   : {func: commandLOAD, minArg: 0, maxArg: 1},
	"FILES"  : {func: commandFILES, minArg: 0, maxArg: 2},
	"BEEP"   : {func: commandBEEP, minArg: 0, maxArg: 2},
	"PLAY"   : {func: commandPLAY, minArg: 0, maxArg: 1},
	"TEMPO"  : {func: commandTEMPO, minArg: 1, maxArg: 1},
	"CLT"    : {func: commandCLT, minArg: 0, maxArg: 0},
	"SCROLL" : {func: commandSCROLL, minArg: 1, maxArg: 1},
	"NEXT"   : {func: commandNEXT, minArg: 0, maxArg: 0},
	"CLV"    : {func: commandCLV, minArg: 0, maxArg: 0},
	"CLEAR"  : {func: commandCLV, minArg: 0, maxArg: 0},
	"CLK"    : {func: commandCLK, minArg: 0, maxArg: 0},
	"GOSUB"  : {func: commandGOSUB, minArg: 1, maxArg: 1},
	"GSB"    : {func: commandGOSUB, minArg: 1, maxArg: 1},
	"RETURN" : {func: commandRETURN, minArg: 0, maxArg: 0},
	"RTN"    : {func: commandRETURN, minArg: 0, maxArg: 0},
	"STOP"   : {func: commandSTOP, minArg: 0, maxArg: 0},
	"CONT"   : {func: commandCONT, minArg: 0, maxArg: 0},
	"RENUM"  : {func: commandRENUM, minArg: 0, maxArg: 2},
	"LRUN"   : {func: commandLRUN, minArg: 0, maxArg: 2},
	"SLEEP"  : null,
	"VIDEO"  : {func: commandVIDEO, minArg: 1, maxArg: 2},
	"POKE"   : {func: commandPOKE, minArg: 2, maxArg: 999},
	"CLP"    : {func: commandCLP, minArg: 0, maxArg: 0},
	"HELP"   : {func: commandHELP, minArg: 0, maxArg: 0},
	"RESET"  : {func: commandRESET, minArg: 0, maxArg: 999},
	"OUT"    : {func: commandOUT, minArg: 1, maxArg: 2},
	"PWM"    : {func: commandPWM, minArg: 2, maxArg: 3},
	"DAC"    : {func: commandDAC, minArg: 2, maxArg: 2},
	"BPS"    : null,
	"CLO"    : {func: commandCLO, minArg: 0, maxArg: 0},
	"SRND"   : {func: commandSRND, minArg: 1, maxArg: 1},
	"COPY"   : {func: commandCOPY, minArg: 3, maxArg: 3},
	"UART"   : {func: commandUART, minArg: 1, maxArg: 2},
	"OK"     : {func: commandOK, minArg: 0, maxArg: 1},
	"IoT.OUT": null,
	"SWITCH" : {func: commandSWITCH, minArg: 0, maxArg: 2},
	"DRAW"   : {func: commandDRAW, minArg: 2, maxArg: 5},
	"WS.LED" : null,
	"SEC.PUBKEY" : {func: commandSEC_PUBKEY, minArg: 2, maxArg: 2},
	"SEC.SIGN"   : {func: commandSEC_SIGN, minArg: 4, maxArg: 4},
	"PC.CLEAR"   : {func: commandPC_CLEAR, minArg: 1, maxArg: 1},
	"PC.LINE"    : {func: commandPC_LINE, minArg: 5, maxArg: 5},
	"PC.STAMP"   : {func: commandPC_STAMP, minArg: 4, maxArg: 4},
	"PC.STAMP1"  : {func: commandPC_STAMP1, minArg: 4, maxArg: 4},
	"PC.IMAGE"   : {func: commandPC_IMAGE, minArg: 1, maxArg: 1},
	"PC.VIDEO"   : {func: commandPC_VIDEO, minArg: 1, maxArg: 1},
	"PC.SSTART"  : {func: commandPC_SSTART, minArg: 1, maxArg: 1},
	"PC.SCREATE" : {func: commandPC_SCREATE, minArg: 2, maxArg: 2},
	"PC.SMOVE"   : {func: commandPC_SMOVE, minArg: 3, maxArg: 3},
	"PC.SOUND"   : {func: commandPC_SOUND, minArg: 8, maxArg: 8},
	"PC.SOUND1"  : {func: commandPC_SOUND1, minArg: 3, maxArg: 3},
	"PC.MSCORE"  : {func: commandPC_MSCORE, minArg: 4, maxArg: 4},
	"PC.MPLAY"   : {func: commandPC_MPLAY, minArg: 1, maxArg: 2},
	"PC.RESET"   : {func: commandPC_RESET, minArg: 0, maxArg: 0},
	"PC.CIRCLE"  : {func: commandPC_CIRCLE, minArg: 4, maxArg: 4},
	"PC.OUT"     : {func: commandPC_OUT, minArg: 1, maxArg: 1},
	"PC.SFLIP"   : {func: commandPC_SFLIP, minArg: 2, maxArg: 2},
	"PC.SROTATE" : {func: commandPC_SROTATE, minArg: 2, maxArg: 2},
	"PC.SUSER"   : {func: commandPC_SUSER, minArg: 3, maxArg: 3},
	"PC.BPS"     : {func: commandPC_BPS, minArg: 1, maxArg: 1},
	"PC.STAMPS"  : {func: commandPC_STAMPS, minArg: 3, maxArg: 5},
	"PC.MLOAD"   : {func: commandPC_MLOAD, minArg: 2, maxArg: 2},
	"PC.WBUF"    : {func: commandPC_WBUF, minArg: 1, maxArg: 1},
};

const basicFunctions = {
	"BTN"   : {func: functionBTN, minArg: 0, maxArg: 1},
	"TICK"  : {func: functionTICK, minArg: 0, maxArg: 1},
	"INKEY" : {func: functionINKEY, minArg: 0, maxArg: 0},
	"ASC"   : {func: functionPEEK, minArg: 1, maxArg: 1},
	"SCR"   : {func: functionSCR, minArg: 0, maxArg: 2},
	"VPEEK" : {func: functionSCR, minArg: 0, maxArg: 2},
	"ABS"   : {func: functionABS, minArg: 1, maxArg: 1},
	"SOUND" : {func: functionSOUND, minArg: 0, maxArg: 0},
	"FREE"  : {func: functionFREE, minArg: 0, maxArg: 0},
	"VER"   : {func: functionVER, minArg: 0, maxArg: 1},
	"FILE"  : {func: functionFILE, minArg: 0, maxArg: 0},
	"PEEK"  : {func: functionPEEK, minArg: 1, maxArg: 1},
	"IN"    : {func: functionIN, minArg: 0, maxArg: 1},
	"ANA"   : {func: functionANA, minArg: 0, maxArg: 1},
	"I2CR"  : null,
	"I2CW"  : null,
	"USR"   : {func: functionUSR, minArg: 1, maxArg: 2},
	"LANG"  : {func: functionLANG, minArg: 0, maxArg: 0},
	"LINE"  : {func: functionLINE, minArg: 0, maxArg: 0},
	"LEN"   : {func: functionLEN, minArg: 1, maxArg: 1},
	"IoT.IN": null,
	"RND"   : {func: functionRND, minArg: 1, maxArg: 1},
	"POS"   : {func: functionPOS, minArg: 0, maxArg: 1},
	"POINT" : {func: functionPOINT, minArg: 0, maxArg: 2},
	"COS"   : {func: functionCOS, minArg: 1, maxArg: 1},
	"SIN"   : {func: functionSIN, minArg: 1, maxArg: 1},
	"SEC.VERIFY" : {func: functionSEC_VERIFY, minArg: 4, maxArg: 4},
};

const expr7_ops = {
	"OR" : function(a, b) { return a != 0 || b != 0 ? 1 : 0; },
	"||" : function(a, b) { return a != 0 || b != 0 ? 1 : 0; }
};

const expr6_ops = {
	"AND": function(a, b) { return a != 0 && b != 0 ? 1 : 0; },
	"&&" : function(a, b) { return a != 0 && b != 0 ? 1 : 0; }
};

const expr5_ops = {
	"="  : function(a, b) { return a == b ? 1 : 0; },
	"==" : function(a, b) { return a == b ? 1 : 0; },
	"<>" : function(a, b) { return a != b ? 1 : 0; },
	"!=" : function(a, b) { return a != b ? 1 : 0; },
	"<"  : function(a, b) { return a < b ? 1 : 0; },
	">"  : function(a, b) { return a > b ? 1 : 0; },
	"<=" : function(a, b) { return a <= b ? 1 : 0; },
	">=" : function(a, b) { return a >= b ? 1 : 0; }
};

const expr4_ops = {
	"+"  : function(a, b) { return arithWrap(a + b); },
	"-"  : function(a, b) { return arithWrap(a - b); },
	"|"  : function(a, b) { return arithWrap(a | b); },
};

const expr3_ops = {
	"*"  : function(a, b) { return arithWrap(a * b); },
	"/"  : function(a, b) {
		if (b == 0) throw "Divide by 0";
		return arithWrap(a / b);
	},
	"%"  : function(a, b) {
		if (b == 0) throw "Divide by 0";
		return arithWrap(a % b);
	},
	"MOD": function(a, b) {
		if (b == 0) throw "Divide by 0";
		return arithWrap(a % b);
	},
	"<<" : function(a, b) { return (b & 0xff) >= 16 ? 0 : arithWrap(a << (b & 15)); },
	">>" : function(a, b) { return (b & 0xff) >= 16 ? 0 : arithWrap((a & 0xffff) >> (b & 15)); },
	"&"  : function(a, b) { return arithWrap(a & b); },
	"^"  : function(a, b) { return arithWrap(a ^ b); }
};

const expr2_ops = {
	"-"  : function(a) { return arithWrap(-a); },
	"~"  : function(a) { return arithWrap(~a); },
	"!"  : function(a) { return a == 0 ? 1 : 0; },
	"NOT": function(a) { return a == 0 ? 1 : 0; }
};

const basicConstants = {
	"LEFT": 28, "RIGHT": 29, "UP": 30, "DOWN": 31, "SPACE": 32
};

var parser = (function() {
	// 指定位置のトークンがキーワード"token"かをチェックする
	function checkToken(tokens, index, token) {
		return index < tokens.length && tokens[index].kind === "keyword" && tokens[index].token === token;
	}

	// 指定位置のトークンが連想配列のキーとしてあるかをチェックする
	function checkTokenSet(tokens, index, tokenSet) {
		return index < tokens.length && tokens[index].kind === "keyword" && (tokens[index].token in tokenSet);
	}

	// 指定位置のトークンが指定の種類かをチェックする
	function checkTokenKind(tokens, index, tokenKind) {
		return index < tokens.length && tokens[index].kind === tokenKind;
	}

	// パース結果オブジェクトを構築する
	function buildParseResult(nodeKind, children, nextIndex) {
		return {"node": {"kind": nodeKind, "nodes": children}, "nextIndex": nextIndex};
	}

	// 各種パースを行う
	function line(tokens, index) {
		const r1 = comment(tokens, index);
		if (r1 !== null) {
			return buildParseResult("line", [r1.node], r1.nextIndex);
		}
		const r2 = if_command(tokens, index);
		if (r2 !== null) {
			const r2_2 = line(tokens, r2.nextIndex);
			if (r2_2 === null) return null;
			return buildParseResult("line", [r2.node, r2_2.node], r2_2.nextIndex);
		}
		const r3 = command(tokens, index);
		if (r3 !== null) {
			const r3_2 = line_separator(tokens, r3.nextIndex);
			if (r3_2 !== null) {
				const r3_3 = line(tokens, r3_2.nextIndex);
				if (r3_3 !== null) {
					return buildParseResult("line", [r3.node, r3_2.node, r3_3.node], r3_3.nextIndex);
				} else {
					return null;
				}
			} else {
				return buildParseResult("line", [r3.node], r3.nextIndex);
			}
		}
		return null;
	}

	function line_separator(tokens, index) {
		if (checkToken(tokens, index, ":") || checkToken(tokens, index, "ELSE")) {
			return buildParseResult("line_separator", [tokens[index]], index + 1);
		} else {
			return null;
		}
	}

	function command(tokens, index) {
		const candidates = [print_command, for_command, input_command, let_command,
			label_definition, general_command];
		for (let i = 0; i < candidates.length; i++) {
			const ret = candidates[i](tokens, index);
			if (ret !== null) {
				return buildParseResult("command", [ret.node], ret.nextIndex);
			}
		}
		return buildParseResult("command", [], index);
	}

	function print_command(tokens, index) {
		if (checkToken(tokens, index, "PRINT") || checkToken(tokens, index, "?")) {
			const aret = print_arguments(tokens, index + 1);
			if (aret === null) return null;
			return buildParseResult("print_command", [tokens[index], aret.node], aret.nextIndex);
		} else {
			return null;
		}
	}

	function print_arguments(tokens, index) {
		const aret = print_argument(tokens, index);
		if (aret === null) {
			return buildParseResult("print_arguments", [], index);
		}
		const sret = print_separator(tokens, aret.nextIndex);
		if (sret === null) {
			return buildParseResult("print_arguments", [aret.node], aret.nextIndex);
		}
		const aret2 = print_arguments(tokens, sret.nextIndex);
		if (aret2 === null) return null;
		return buildParseResult("print_arguments", [aret.node, sret.node, aret2.node], aret2.nextIndex);
	}

	function print_argument(tokens, index) {
		if (checkTokenKind(tokens, index, "string")) {
			return buildParseResult("print_argument", [tokens[index]], index + 1);
		}
		const pret = print_modifier(tokens, index);
		if (pret !== null) {
			return buildParseResult("print_argument", [pret.node], pret.nextIndex);
		}
		const eret = expr(tokens, index);
		if (eret !== null) {
			return buildParseResult("print_argument", [eret.node], eret.nextIndex);
		}
		return null;
	}

	function print_separator(tokens, index) {
		if (checkToken(tokens, index, ",") || checkToken(tokens, index, ";")) {
			return buildParseResult("print_separator", [tokens[index]], index + 1);
		}
		return null;
	}

	function print_modifier(tokens, index) {
		const mret = modifier_name(tokens, index);
		if (mret === null) return null;
		if (!checkToken(tokens, mret.nextIndex, "(")) return null;
		const aret = function_arguments(tokens, mret.nextIndex + 1);
		if (aret === null) return null;
		if (!checkToken(tokens, aret.nextIndex, ")")) return null;
		return buildParseResult("print_modifier",
			[mret.node, tokens[mret.nextIndex], aret.node, tokens[aret.nextIndex]], aret.nextIndex + 1);
	}

	function if_command(tokens, index) {
		if (checkToken(tokens, index, "IF")) {
			const eres = expr(tokens, index + 1);
			if (eres === null) return null;
			if (checkToken(tokens, eres.nextIndex, "THEN")) {
				return buildParseResult("if_command",
					[tokens[index], eres.node, tokens[eres.nextIndex]], eres.nextIndex + 1);
			} else {
				return buildParseResult("if_command", [tokens[index], eres.node], eres.nextIndex);
			}
		} else {
			return null;
		}
	}

	function for_command(tokens, index) {
		if (checkToken(tokens, index, "FOR")) {
			const vres = variable(tokens, index + 1);
			if (vres === null) return null;
			if (!checkToken(tokens, vres.nextIndex, "=")) return null;
			const eres = expr(tokens, vres.nextIndex + 1);
			if (eres === null) return null;
			if (!checkToken(tokens, eres.nextIndex, "TO")) return null;
			const eres2 = expr(tokens, eres.nextIndex + 1);
			if (eres2 === null) return null;
			if (checkToken(tokens, eres2.nextIndex, "STEP")) {
				const eres3 = expr(tokens, eres2.nextIndex + 1);
				if (eres3 === null) return null;
				return buildParseResult("for_command",
					[tokens[index], vres.node, tokens[vres.nextIndex], eres.node,
						tokens[eres.nextIndex], eres2.node, tokens[eres2.nextIndex], eres3.node],
					eres3.nextIndex);
			} else {
				return buildParseResult("for_command",
					[tokens[index], vres.node, tokens[vres.nextIndex], eres.node,
						tokens[eres.nextIndex], eres2.node],
					eres2.nextIndex);
			}
		} else {
			return null;
		}
	}

	function input_command(tokens, index) {
		if (checkToken(tokens, index, "INPUT")) {
			const variable1 = variable(tokens, index + 1);
			if (variable1 !== null) {
				return buildParseResult("input_command", [tokens[index], variable1.node], variable1.nextIndex);
			} else {
				if (checkTokenKind(tokens, index + 1, "string") && checkToken(tokens, index + 2, ",")) {
					const variable2 = variable(tokens, index + 3);
					if (variable2 !== null) {
						return buildParseResult("input_command",
							[tokens[index], tokens[index + 1], tokens[index + 2], variable2.node],
							variable2.nextIndex);
					} else {
						return null;
					}
				} else {
					return null;
				}
			}
		} else {
			return null;
		}
	}

	function let_command(tokens, index) {
		if (checkToken(tokens, index, "LET")) {
			const vret = variable(tokens, index + 1);
			if (vret === null) return null;
			if (!checkToken(tokens, vret.nextIndex, ",")) return null;
			const aret = argument_list(tokens, vret.nextIndex + 1);
			if (aret === null) return null;
			return buildParseResult("let_command",
				[tokens[index], vret.node, tokens[vret.nextIndex], aret.node], aret.nextIndex);
		} else {
			const vret = variable(tokens, index);
			if (vret === null) return null;
			if (!checkToken(tokens, vret.nextIndex, "=")) return null;
			const eret = expr(tokens, vret.nextIndex + 1);
			if (eret === null) return null;
			return buildParseResult("let_command", [vret.node, tokens[vret.nextIndex], eret.node],
				eret.nextIndex);
		}
	}

	function label_definition(tokens, index) {
		if (checkTokenKind(tokens, index, "label")) {
			const junk = label_junk(tokens, index + 1);
			if (junk === null) return null;
			return buildParseResult("label_definition", [tokens[index], junk.node], junk.nextIndex);
		} else {
			return null;
		}
	}

	function label_junk(tokens, index) {
		if (tokens.length <= index || line_separator(tokens, index) !== null) {
			return buildParseResult("label_junk", [], index);
		} else {
			const junk = label_junk(tokens, index + 1);
			if (junk === null) return null;
			return buildParseResult("label_junk", [tokens[index], junk.node], junk.nextIndex);
		}
	}

	function comment(tokens, index) {
		const result = [];
		if (checkToken(tokens, index, "REM") || checkToken(tokens, index, "'")) {
			result.push(tokens[index]);
			index++;
			const r = comment_content(tokens, index);
			if (r === null) return null;
			result.push(r.node);
			index = r.nextIndex;
			return buildParseResult("comment", result, index);
		} else {
			return null;
		}
	}

	function comment_content(tokens, index) {
		if (index < tokens.length) {
			return buildParseResult("comment_content", [tokens[index]], index + 1);
		} else {
			return buildParseResult("comment_content", [], index);
		}
	}

	function general_command(tokens, index) {
		const cret = command_name(tokens, index);
		if (cret === null) return null;
		const aret = function_arguments(tokens, cret.nextIndex);
		if (aret === null) return null;
		return buildParseResult("general_command", [cret.node, aret.node], aret.nextIndex);
	}

	function function_arguments(tokens, index) {
		const aret = argument_list(tokens, index);
		if (aret === null) {
			return buildParseResult("function_arguments", [], index);
		} else {
			return buildParseResult("function_arguments", [aret.node], aret.nextIndex);
		}
	}

	function argument_list(tokens, index) {
		const eret = expr(tokens, index);
		if (eret === null) return null;
		if (checkToken(tokens, eret.nextIndex, ",")) {
			const aret = argument_list(tokens, eret.nextIndex + 1);
			if (aret === null) return null;
			return buildParseResult("argument_list",
				[eret.node, tokens[eret.nextIndex], aret.node], aret.nextIndex);
		} else {
			return buildParseResult("argument_list", [eret.node], eret.nextIndex);
		}
	}

	function variable(tokens, index) {
		if (checkTokenSet(tokens, index, variableIndice)) {
			return buildParseResult("variable", [tokens[index]], index + 1);
		} else if (checkToken(tokens, index, "[")) {
			const eret = expr(tokens, index + 1);
			if (eret === null) return null;
			if (checkToken(tokens, eret.nextIndex, "]")) {
				return buildParseResult("variable",
					[tokens[index], eret.node, tokens[eret.nextIndex]], eret.nextIndex + 1);
			} else {
				return null;
			}
		} else {
			return null;
		}
	}

	function modifier_name(tokens, index) {
		if (checkTokenSet(tokens, index, printModifiers)) {
			return buildParseResult("modifier_name", [tokens[index]], index + 1);
		}
		return null;
	}

	function command_name(tokens, index) {
		if (checkTokenSet(tokens, index, basicCommands)) {
			return buildParseResult("command_name", [tokens[index]], index + 1);
		}
		return null;
	}

	function function_name(tokens, index) {
		if (checkTokenSet(tokens, index, basicFunctions)) {
			return buildParseResult("function_name", [tokens[index]], index + 1);
		}
		return null;
	}

	function constant(tokens, index) {
		if (checkTokenSet(tokens, index, basicConstants)) {
			return buildParseResult("constant", [tokens[index]], index + 1);
		}
		return null;
	}

	function expr(tokens, index) {
		const eres = expr7(tokens, index);
		if (eres === null) return null;
		return buildParseResult("expr", [eres.node], eres.nextIndex);
	}

	function buildExprParser(name, nextLevel, ops) {
		return function(tokens, index) {
			const nres = nextLevel(tokens, index);
			if (nres === null) return null;
			let result = buildParseResult(name, [nres.node], nres.nextIndex);
			let nextIndex = nres.nextIndex;
			for (;;) {
				if (!checkTokenSet(tokens, nextIndex, ops)) return result;
				const eres = nextLevel(tokens, nextIndex + 1);
				if (eres === null) return null;
				result = buildParseResult(name, [result.node, tokens[nextIndex], eres.node], eres.nextIndex);
				nextIndex = eres.nextIndex;
			}
		};
	}

	function expr2(tokens, index) {
		if (checkTokenSet(tokens, index, expr2_ops)) {
			const eres = expr2(tokens, index + 1);
			if (eres === null) return null;
			return buildParseResult("expr2", [tokens[index], eres.node], eres.nextIndex);
		} else {
			const eres = expr1(tokens, index);
			if (eres === null) return null;
			return buildParseResult("expr2", [eres.node], eres.nextIndex);
		}
	}
	// BNFの順番通りにするとundefinedになるので、この順番にする
	var expr3 = buildExprParser("expr3", expr2, expr3_ops);
	var expr4 = buildExprParser("expr4", expr3, expr4_ops);
	var expr5 = buildExprParser("expr5", expr4, expr5_ops);
	var expr6 = buildExprParser("expr6", expr5, expr6_ops);
	var expr7 = buildExprParser("expr7", expr6, expr7_ops);

	function expr1(tokens, index) {
		if (checkToken(tokens, index, "(")) {
			const eres = expr7(tokens, index + 1);
			if (eres === null) return null;
			if (!checkToken(tokens, eres.nextIndex, ")")) return null;
			return buildParseResult("expr1",
				[tokens[index], eres.node, tokens[eres.nextIndex]], eres.nextIndex + 1);
		}
		if (checkTokenSet(tokens, index, basicFunctions)) {
			if (!checkToken(tokens, index + 1, "(")) return null;
			const args = function_arguments(tokens, index + 2);
			if (args === null) return null;
			if (!checkToken(tokens, args.nextIndex, ")")) return null;
			const function_name = {kind: "function_name", nodes: [tokens[index]]};
			return buildParseResult("expr1",
				[function_name, tokens[index + 1], args.node, tokens[args.nextIndex]], args.nextIndex + 1);
		}
		const cres = constant(tokens, index);
		if (cres !== null) {
			return buildParseResult("expr1", [cres.node], cres.nextIndex);
		}
		const vres = variable(tokens, index);
		if (vres !== null) {
			return buildParseResult("expr1", [vres.node], vres.nextIndex);
		}
		if (checkTokenKind(tokens, index, "number") || checkTokenKind(tokens, index, "label") ||
		checkTokenKind(tokens, index, "string")) {
			return buildParseResult("expr1", [tokens[index]], index + 1);
		}
		return null;
	}

	return {
		"parseExpr": function(tokens, allowExtraTokens = false) {
			const res = expr(tokens, 0);
			if (res === null || (res.nextIndex < tokens.length && !allowExtraTokens)) {
				return null;
			}
			return res.node;
		},
		"parseLine": function(tokens) {
			const res = line(tokens, 0);
			if (res === null || res.nextIndex < tokens.length) {
				return null;
			}
			return res.node;
		},
	};
})();

var compiler = (function() {
	function compileExpr(ast) {
		function binaryOpFunction(nextFunc, opList) {
			const func = function(ast) {
				if (ast.nodes.length === 1) {
					return nextFunc(ast.nodes[0]);
				} else {
					const expr_left = func(ast.nodes[0]);
					const expr_right = nextFunc(ast.nodes[2]);
					const op = opList[ast.nodes[1].token];
					if (op === null) {
						const token = ast.nodes[1].token;
						return function() {
							throw "Not implemented: " + token;
						};
					} else {
						return async function() {
							const left = await expr_left();
							const right = await expr_right();
							return op(left, right);
						};
					}
				}
			};
			return func;
		}
		function expr1(ast) {
			if (ast.nodes.length === 3) {
				return expr7(ast.nodes[1]);
			} else if (ast.nodes.length === 4) {
				const funcName = ast.nodes[0].nodes[0].token;
				const funcInfo = basicFunctions[funcName];
				const args = compileArguments(ast.nodes[2]);
				if (funcInfo === null) {
					return function() {
						throw "Not implemented: " + funcName;
					};
				} else {
					if (args.length < funcInfo.minArg || funcInfo.maxArg < args.length) {
						throw null;
					}
					const func = funcInfo.func;
					return async function() {
						const argValues = [];
						for (let i = 0; i < args.length; i++) {
							argValues.push(await args[i]());
						}
						return func(argValues);
					};
				}
			} else {
				const node = ast.nodes[0];
				if (node.kind === "constant") {
					const value = basicConstants[node.nodes[0].token];
					return function() { return value; }
				} else if (node.kind === "variable") {
					if (node.nodes.length === 1) {
						const varId = variableIndice[node.nodes[0].token];
						return function() {
							return readArray(ARRAY_SIZE_JAM + varId);
						};
					} else {
						const expr = compileExpr(node.nodes[1]);
						return async function() {
							const idx = await expr();
							if (idx < 0 || ARRAY_SIZE <= idx) throw "Index out of range";
							if (idx < ARRAY_SIZE_JAM) {
								return readArray(idx);
							} else {
								return readArray(idx - ARRAY_SIZE_JAM + 128);
							}
						};
					}
				} else if (node.kind === "number") {
					let nstr = node.token;
					let value = 0, delta = 10;
					if (nstr.charAt(0) === "#") {
						nstr = nstr.substr(1);
						delta = 16;
					} else if (nstr.charAt(0) == "`") {
						nstr = nstr.substr(1);
						delta = 2;
					}
					for (let i = 0; i < nstr.length; i++) {
						value = (value * delta + parseInt(nstr.substr(i, 1), delta)) & 0xffff;
					}
					if (value >= 32768) value -= 65536;
					return function() { return value; };
				} else if (node.kind === "label") {
					return function() {
						if (node.token in programLabels) {
							return programLabels[node.token];
						} else {
							throw "Line error";
						}
					};
				} else if (node.kind === "string") {
					const addr = node.address + 1;
					return function() { return addr; };
				} else {
					throw "Unknown expr1 kind: " + node.kind;
				}
			}
		}
		function expr2(ast) {
			if (ast.nodes.length === 1) {
				return expr1(ast.nodes[0]);
			} else {
				const expr_right = expr2(ast.nodes[1]);
				const op = expr2_ops[ast.nodes[0].token];
				if (op === null) {
					const token = ast.nodes[0].token;
					return function() {
						throw "Not implemented: " + token;
					};
				} else {
					return async function() {
						const right = await expr_right();
						return op(right);
					};
				}
			}
		}
		var expr3 = binaryOpFunction(expr2, expr3_ops);
		var expr4 = binaryOpFunction(expr3, expr4_ops);
		var expr5 = binaryOpFunction(expr4, expr5_ops);
		var expr6 = binaryOpFunction(expr5, expr6_ops);
		var expr7 = binaryOpFunction(expr6, expr7_ops);

		return expr7(ast.nodes[0]);
	}

	function compileArguments(ast) {
		if (ast.kind === "function_arguments") {
			if (ast.nodes.length === 0) {
				return [];
			} else {
				return compileArguments(ast.nodes[0]);
			}
		}
		let currentNode = ast;
		const res = [];
		for (;;) {
			res.push(compileExpr(currentNode.nodes[0]));
			if (currentNode.nodes.length >= 3) {
				currentNode = currentNode.nodes[2];
			} else {
				break;
			}
		}
		return res;
	}

	function compilePrintArguments(ast) {
		if (ast.nodes.length === 0) {
			return [{expr: function(){ return ""; }, suffix: "\n"}];
		}
		const args = [];
		let currentNode = ast;
		for (;;) {
			const argNode = currentNode.nodes[0].nodes[0];
			let arg = {expr: function(){ return ""; }, suffix: "\n"};
			if (currentNode.nodes.length === 3) {
				const token = currentNode.nodes[1].nodes[0].token;
				if (token === ",") arg.suffix = " ";
				else if (token === ";") arg.suffix = "";
			}
			if (argNode.kind === "string") {
				const strToken = argNode.token;
				const minusLength = strToken.charAt(strToken.length - 1) === "\"" ? 2 : 1;
				arg.suffix = strToken.substr(1, strToken.length - minusLength) + arg.suffix;
			} else if (argNode.kind === "print_modifier") {
				const modifierName = argNode.nodes[0].nodes[0].token;
				const modifierInfo = printModifiers[modifierName];
				const args = compileArguments(argNode.nodes[2]);
				if (modifierInfo === null) {
					arg.expr = function() {
						throw "Not implemented: " + modifierName;
					};
				} else {
					if (args.length < modifierInfo.minArg || modifierInfo.maxArg < args.length) {
						throw null;
					} else {
						const modifier = modifierInfo.func;
						arg.expr = async function() {
							const argValues = [];
							for (let i = 0; i < args.length; i++) {
								argValues.push(await args[i]());
							}
							return modifier(argValues);
						};
					}
				}
			} else {
				arg.expr = compileExpr(argNode);
			}
			args.push(arg);
			if (currentNode.nodes.length < 3) {
				break;
			} else {
				currentNode = currentNode.nodes[2];
				if (currentNode.nodes.length === 0) break;
			}
		}
		return args;
	}

	function compileCommand(ast, lineno, nextPosInLine) {
		if(ast.nodes.length === 0) {
			return function() { return [lineno, nextPosInLine]; };
		}
		const command = ast.nodes[0];
		const kind = command.kind;
		if (kind === "print_command") {
			const args = compilePrintArguments(command.nodes[1]);
			return async function() {
				for (let i = 0; i < args.length; i++) {
					await putString((await args[i].expr()) + args[i].suffix);
				}
				return [lineno, nextPosInLine];
			};
		} else if (kind === "input_command") {
			let prompt, varNode;
			if (command.nodes[1].kind === "string") {
				const strToken = command.nodes[1].token;
				prompt = strToken.substr(1, strToken.length - 2);
				varNode = command.nodes[3];
			} else {
				prompt = "?";
				varNode = command.nodes[1];
			}
			if (varNode.nodes.length === 1) {
				const varId = variableIndice[varNode.nodes[0].token];
				return async function() {
					await commandINPUT(prompt, ARRAY_SIZE_JAM + varId);
					return [lineno, nextPosInLine];
				};
			} else {
				const idxExpr = compileExpr(varNode.nodes[1]);
				return async function() {
					const idx = await idxExpr();
					if (idx < 0 || ARRAY_SIZE <= idx) throw "Index out of range";
					if (idx < ARRAY_SIZE_JAM) {
						await commandINPUT(prompt, idx);
					} else {
						await commandINPUT(prompt, idx - ARRAY_SIZE_JAM + 128);
					}
					return [lineno, nextPosInLine];
				};
			}
		} else if (kind === "let_command") {
			if (command.nodes[0].kind === "keyword") {
				const varNode = command.nodes[1];
				const args = compileArguments(command.nodes[3]);
				if (varNode.nodes.length === 1) {
					if (args.length !== 1) throw null;
					const varId = variableIndice[varNode.nodes[0].token];
					return async function() {
						writeArray(ARRAY_SIZE_JAM + varId, await args[0]());
						return [lineno, nextPosInLine];
					};
				} else {
					const idxExpr = compileExpr(varNode.nodes[1]);
					return async function() {
						const idx = await idxExpr();
						if (idx < 0 || idx + args.length > ARRAY_SIZE) throw "Index out of range";
						for (let i = 0; i < args.length; i++) {
							const accessIdxRaw = idx + i;
							const accessIdx = accessIdxRaw < ARRAY_SIZE_JAM ? accessIdxRaw : accessIdxRaw - ARRAY_SIZE_JAM + 128;
							writeArray(accessIdx, await args[i]());
						}
						return [lineno, nextPosInLine];
					};
				}
			} else {
				const varNode = command.nodes[0];
				const expr = compileExpr(command.nodes[2]);
				if (varNode.nodes.length === 1) {
					const varId = variableIndice[varNode.nodes[0].token];
					return async function() {
						writeArray(ARRAY_SIZE_JAM + varId, await expr());
						return [lineno, nextPosInLine];
					};
				} else {
					const idxExpr = compileExpr(varNode.nodes[1]);
					return async function() {
						const idx = await idxExpr();
						if (idx < 0 || ARRAY_SIZE <= idx) throw "Index out of range";
						if (idx < ARRAY_SIZE_JAM) {
							writeArray(idx, await expr());
						} else {
							writeArray(idx - ARRAY_SIZE_JAM + 128, await expr());
						}
						return [lineno, nextPosInLine];
					};
				}
			}
		} else if (kind === "label_definition") {
			return function() {
				return [lineno, nextPosInLine];
			};
		} else if (kind === "general_command") {
			const name = command.nodes[0].nodes[0].token;
			const args = compileArguments(command.nodes[1]);
			if (name in basicCommands) {
				const commandFuncInfo = basicCommands[name];
				if (commandFuncInfo === null) {
					return function() {
						throw "Not implemented: " + name;
						return [lineno, nextPosInLine];
					};
				} else {
					if (args.length < commandFuncInfo.minArg || commandFuncInfo.maxArg < args.length) {
						throw null;
					}
					const commandFunc = commandFuncInfo.func;
					return async function() {
						const argValues = [];
						for (let i = 0; i < args.length; i++) {
							argValues.push(await args[i]());
						}
						const nextPos = await commandFunc(argValues, [lineno, nextPosInLine]);
						if (nextPos) return nextPos;
						return [lineno, nextPosInLine];
					};
				}
			} else {
				throw "Unknown command: " + name;
			}
		} else {
			throw "Unknown command node: " + kind;
		}
	}

	function compileFor(ast, lineno, nextPosInLine) {
		const command = ast.nodes[0];
		const loopVariableNode = command.nodes[1];
		const loopFromExpr = compileExpr(command.nodes[3]);
		const loopToExpr = compileExpr(command.nodes[5]);
		const loopStepExpr = command.nodes.length > 7 ? compileExpr(command.nodes[7]) : function() { return 1; };
		let getLoopVariableIdx;
		if (loopVariableNode.nodes.length === 1) {
			const varId = variableIndice[loopVariableNode.nodes[0].token];
			getLoopVariableIdx = function() { return ARRAY_SIZE_JAM + varId; };
		} else {
			const idxExpr = compileExpr(loopVariableNode.nodes[1]);
			getLoopVariableIdx = async function() {
				const idx = await idxExpr();
				if (idx < 0 || ARRAY_SIZE <= idx) throw "Index out of range";
				return idx < ARRAY_SIZE_JAM ? idx : idx - ARRAY_SIZE_JAM + 128;
			};
		}
		const initialize = async function() {
			const variableIndex = await getLoopVariableIdx();
			const loopFrom = await loopFromExpr();
			const loopTo = await loopToExpr();
			const loopStep = await loopStepExpr();
			if ((loopStep > 0 && loopFrom > loopTo) || (loopStep < 0 && loopFrom < loopTo)) {
				throw "Illegal argument";
			}
			writeArray(variableIndex, loopFrom);
			forStack.push([lineno, nextPosInLine - 1]);
			return [lineno, nextPosInLine];
		};
		const step = async function() {
			if (forStack.length === 0) throw "FOR step internal error";
			const variableIndex = await getLoopVariableIdx();
			const loopFrom = await loopFromExpr();
			const loopTo = await loopToExpr();
			const loopStep = await loopStepExpr();
			const variableValue = readArray(variableIndex);
			let endLoop = false;
			const newVariableValue = arithWrap(variableValue + loopStep);
			if (loopFrom <= loopTo && loopTo < newVariableValue) endLoop = true;
			if (newVariableValue < loopTo && loopTo < loopFrom) endLoop = true;
			if (variableValue === loopTo) endLoop = true;
			if (endLoop) {
				const nextPlace = forStack.pop();
				forStack.pop(); // このFORの位置情報を消す
				return nextPlace;
			} else {
				forStack.pop();
				writeArray(variableIndex, newVariableValue);
				return [lineno, nextPosInLine];
			}
		}
		return [initialize, step];
	}

	function compileIf(ast, lineno, nextPosInLineTrue, nextPosInLineFalse) {
		const expr = compileExpr(ast.nodes[1]);
		return async function() {
			return [lineno, (await expr()) === 0 ? nextPosInLineFalse : nextPosInLineTrue];
		};
	}

	function compileLine(ast, lineno, posInLine) {
		if (ast.nodes[0].kind === "comment") {
			return [function() { return null; }];
		}
		let programIndex = posInLine;
		const programNodes = [];
		let currentNode = ast;
		for (;;) {
			if (currentNode.nodes.length === 0) {
				break;
			} else if (currentNode.nodes[0].kind === "command") {
				programNodes.push({idx: programIndex, node: currentNode.nodes[0]});
				if (currentNode.nodes[0].nodes.length > 0 && currentNode.nodes[0].nodes[0].kind === "for_command") {
					programIndex += 2;
				} else {
					programIndex++;
				}
				if (currentNode.nodes.length >= 3) {
					if (currentNode.nodes[1].nodes.length > 0 && currentNode.nodes[1].nodes[0].token === "ELSE") {
						programNodes.push({idx: programIndex, node: currentNode.nodes[1]});
					}
					currentNode = currentNode.nodes[2];
				} else {
					break;
				}
			} else if (currentNode.nodes[0].kind === "if_command") {
				programNodes.push({idx: programIndex, node: currentNode.nodes[0]});
				programIndex++;
				currentNode = currentNode.nodes[1];
			} else {
				break;
			}
		}
		const compilationResult = [];
		let nextElseIndex = programIndex;
		let nextIsElse = false, ifBeforeElse = false;
		for(let i = programNodes.length - 1; i >= 0; i--) {
			const nextPos = nextIsElse ? programIndex : programNodes[i].idx + 1;
			if (programNodes[i].node.kind === "command") {
				if (programNodes[i].node.nodes.length > 0 && programNodes[i].node.nodes[0].kind === "for_command") {
					const compiled = compileFor(programNodes[i].node, lineno, nextPos + 1);
					compilationResult.unshift(compiled[1]);
					compilationResult.unshift(compiled[0]);
				} else {
					compilationResult.unshift(compileCommand(programNodes[i].node, lineno, nextPos));
				}
				nextIsElse = false;
			} else if (programNodes[i].node.kind === "if_command") {
				compilationResult.unshift(compileIf(programNodes[i].node, lineno, nextPos, ifBeforeElse ? programIndex : nextElseIndex));
				nextIsElse = false;
				ifBeforeElse = true;
			} else {
				nextElseIndex = programNodes[i].idx;
				nextIsElse = true;
				ifBeforeElse = false;
			}
		}
		if (compilationResult.length === 0) {
			compilationResult.push(function() { return null; });
		}
		return compilationResult;
	}

	return {
		"compileExpr": function(ast) {
			return compileExpr(ast);
		},
		"compileLine": function(ast, lineno = 0) {
			if (ast.kind === "line") {
				try {
					return compileLine(ast, lineno, 0);
				} catch (e) {
					return [function() {
						throw e === null ? "Syntax error" : e;
					}];
				}
			} else {
				return null;
			}
		},
	};
})();
