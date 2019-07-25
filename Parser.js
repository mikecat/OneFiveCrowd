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
	"LEFT", "RIGHT", "UP", "DOWN", "SPACE", "MOD", "DRAW", "POINT",
	"COS", "SIN", "WS.LED",
	":", "+", "-", "*", "/", "%", "(", ")", "=", "<", ">", ",", "[", "]", ";",
	"&", "|", "^", "~", "?", "'",
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
			const tokenInfo = getTokenInfo(str, i);
			if (tokenInfo !== null) {
				// 登録されているキーワード
				result.push(createTokenInfo("keyword", tokenInfo.token, firstAddr + i));
				i = tokenInfo.nextIndex;
				if (tokenInfo.token === "REM" || tokenInfo.token === "'") {
					// コメント
					result.push(createTokenInfo("comment", str.substr(i), firstAddr + i));
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
                   | print_argument print_separator print_arguments
  print_argument ::= string
                   | print_modifier
                   | expr
 print_separator ::= "," | ";"
  print_modifier ::= modifier_name "(" arguments ")"
      if_command ::= "IF" expr "THEN"
                   | "IF" expr
     for_command ::= "FOR" variable "=" expr "TO" expr
                   | "FOR" variable "=" expr "TO" expr "STEP" expr
   input_command ::= "INPUT" variable
                   | "INPUT" string "," variable
     let_command ::= "LET" variable "," arguments
                   | variable "=" expr
label_definition ::= label label_junk
      label_junk ::= (空)
                   | (line_separatorを除く任意のトークン) label_junk
         comment ::= "REM" comment_content
                   | "'" comment_content
 comment_content ::= (空)
                   | (任意のトークン)
 general_command ::= command_name arguments
       arguments ::= (空)
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
                   | "DRAW" | "WS.LED"
   function_name ::= "BTN" | "TICK" | "INKEY" | "ASC" | "SCR" | "VPEEK" | "ABS"
                   | "SOUND" | "FREE" | "VER" | "FILE" | "PEEK" | "IN" | "ANA"
                   | "I2CR" | "I2CW" | "USR" | "LANG" | "LINE" | "LEN" | "IoT.IN"
                   | "RND" | "POINT" | "COS" | "SIN"

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
                   | "LEFT | "RIGHT" | "UP" | "DOWN" | "SPACE"
                   | integer | variable | label | string
*/

function parser(tokens) {
	return {"kind": "comment", "nodes": []}; // 仮
}
