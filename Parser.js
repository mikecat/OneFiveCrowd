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
                     | "DRAW" | "WS.LED"
     function_name ::= "BTN" | "TICK" | "INKEY" | "ASC" | "SCR" | "VPEEK" | "ABS"
                     | "SOUND" | "FREE" | "VER" | "FILE" | "PEEK" | "IN" | "ANA"
                     | "I2CR" | "I2CW" | "USR" | "LANG" | "LINE" | "LEN" | "IoT.IN"
                     | "RND" | "POINT" | "COS" | "SIN"
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
                     | constant | variable| number | label | string
*/

const variableIndice = {
	"A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6,
	"H": 7, "I": 8, "J": 9, "K":10, "L":11, "M":12, "N":13,
	"O":14, "P":15, "Q":16, "R":17, "S":18, "T":19, "U":20,
	"V":21, "W":22, "X":23, "Y":24, "Z":25
};

const printModifiers = {
	"CHR$": null,
	"DEC$": null,
	"HEX$": null,
	"BIN$": null,
	"STR$": null
};

const basicCommands = {
	"LED"    : null,
	"WAIT"   : null,
	"RUN"    : null,
	"LIST"   : null,
	"GOTO"   : null,
	"END"    : null,
	"NEW"    : null,
	"LOCATE" : null,
	"LC"     : null,
	"CLS"    : null,
	"SAVE"   : null,
	"LOAD"   : null,
	"FILES"  : null,
	"BEEP"   : null,
	"PLAY"   : null,
	"TEMPO"  : null,
	"CLT"    : null,
	"SCROLL" : null,
	"NEXT"   : null,
	"CLV"    : null,
	"CLEAR"  : null,
	"CLK"    : null,
	"GOSUB"  : null,
	"GSB"    : null,
	"RETURN" : null,
	"RTN"    : null,
	"STOP"   : null,
	"CONT"   : null,
	"RENUM"  : null,
	"LRUN"   : null,
	"SLEEP"  : null,
	"VIDEO"  : null,
	"POKE"   : null,
	"CLP"    : null,
	"HELP"   : null,
	"RESET"  : null,
	"OUT"    : null,
	"PWM"    : null,
	"BPS"    : null,
	"CLO"    : null,
	"SRND"   : null,
	"COPY"   : null,
	"UART"   : null,
	"OK"     : null,
	"IoT.OUT": null,
	"SWITCH" : null,
	"DRAW"   : null,
	"WS.LED" : null
};

const basicFunctions = {
	"BTN"   : null,
	"TICK"  : null,
	"INKEY" : null,
	"ASC"   : null,
	"SCR"   : null,
	"VPEEK" : null,
	"ABS"   : null,
	"SOUND" : null,
	"FREE"  : null,
	"VER"   : null,
	"FILE"  : null,
	"PEEK"  : null,
	"IN"    : null,
	"ANA"   : null,
	"I2CR"  : null,
	"I2CW"  : null,
	"USR"   : null,
	"LANG"  : null,
	"LINE"  : null,
	"LEN"   : null,
	"IoT.IN": null,
	"RND"   : null,
	"POINT" : null,
	"COS"   : null,
	"SIN"   : null
};

const expr7_ops = {
	"OR" : null,
	"||" : null
};

const expr6_ops = {
	"AND": null,
	"&&" : null
};

const expr5_ops = {
	"="  : null,
	"==" : null,
	"<>" : null,
	"!=" : null,
	"<"  : null,
	">"  : null,
	"<=" : null,
	">=" : null
};

const expr4_ops = {
	"+"  : null,
	"-"  : null,
	"|"  : null,
};

const expr3_ops = {
	"*"  : null,
	"/"  : null,
	"%"  : null,
	"MOD": null,
	"<<" : null,
	">>" : null,
	"&"  : null,
	"^"  : null
};

const expr2_ops = {
	"-"  : null,
	"~"  : null,
	"!"  : null,
	"NOT": null
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
		return buildParseResult("genaral_command", [cret.node, aret.node], aret.nextIndex);
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
			return buildParseResult("expr2", [ores.node, eres.node], eres.nextIndex);
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
			const ares = function_arguments(tokens, index + 2);
			if (ares === null) return null;
			if (!checkToken(tokens, ares.nextIndex, ")")) return null;
			return buildParseResult("expr1",
				[tokens[index], tokens[index + 1], ares.node, tokens[ares.nextIndex]], ares.nextIndex + 1);
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

	return function (tokens) {
		const res = line(tokens, 0);
		if (res === null || res.nextIndex < tokens.length) {
			return null;
		}
		return res.node;
	};
})();
