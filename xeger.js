(function () {
	
	var ReverseRegexThing = function () {
		this.REGEX_TOKEN_REGEX = /\\.|\((?:\?.)?|\)|\^|\$|\[\^?(?:\\.|[^\]])+\]|[\?\*\+][\?\+]?|\{\d+(?:,(?:\d+))?\}|\.|[^\\\.\?\*\+\(\)\{\}\[\]\^\$]+/g;
		this.BRACE_QUANTIFIER_REGEX = /^\{\d+(?:,(?:\d+))?\}$/;

		// Since some of the quantifiers permit arbitrarily large numbers, let's pick a reasonably big one and go with that.
		this.PSEUDOINFINITY = 100;

		this.WHITESPACE_CLASS = [' ', '\t'];
		
		this.parse = function (regex) {
			var tokens = regex.match(this.REGEX_TOKEN_REGEX);
			var structure = this.parseStructure(tokens, 0, 0);
			
			return structure;
		};
		
		this.parseStructure = function(tokenArray, startIndex, parenthesisLevel) {
			var structure = [];
			
			for (var i = startIndex; i < tokenArray.length; i++) {
				var token = tokenArray[i];
				if (token[0] === "(") {
					var innerStructure = this.parseStructure(tokenArray, i + 1, parenthesisLevel + 1);
					structure.push(innerStructure.structure);
					i = innerStructure.lastIndex;
				} else if (token === ")" && parenthesisLevel > 0) {
					return {structure: structure, lastIndex: i};
				} else {
					var parsedToken = this.parseToken(token);
					if (parsedToken.tokenType === "multiplier") {
						var modifiedToken = structure[structure.length - 1];
						if (modifiedToken.tokenType === "literal" && modifiedToken.content.length > 1) {
							var newToken = {
								tokenType: "literal",
								content: modifiedToken.content[modifiedToken.content.length - 1],
								multiplicity: parsedToken.multiplicity
							};
							modifiedToken.content = modifiedToken.content.substring(0, modifiedToken.content.length - 1);
							structure.push(newToken);
						} else {
							modifiedToken.multiplicity = parsedToken.multiplicity;
						}
					} else {
						structure.push(parsedToken);
					}
				}
			}
			
			return parenthesisLevel ? null : structure;
		};
		
		this.parseToken = function (inToken) {
			switch (inToken[0]) {
				case '|':
					return {tokenType: "pipe"};
				case '[':
					return this.parseBracketClass(inToken);
				case '\\':
					return this.parseEscapedCharacter(inToken);
				case '?':
				case '*':
				case '+':
				case '{':
					return this.parseQuantifier(inToken);
				case '^':
					return {tokenType: "start"};
				case '$':
					return {tokenType: "end"};
				case '.':
					return {tokenType: "wildcard"};
				default:
					return {tokenType: "literal", content: inToken};
			}	
		};

		this.parseBracketClass = function (inToken) {
			var outToken = {tokenType: "or", operands: []};
			var startIndex = 1;
			if (inToken[startIndex] === "^") {
				startIndex++;
				outToken.tokenType = "nor";
			}
			if (inToken[startIndex] === "-") {
				startIndex++;
				outToken.operands.push("-");
			}
			for (var i = startIndex; i < inToken.length - 1; i++) {
				if (inToken[i] === "\\") {
					i++;
					outToken.operands.push(inToken[i]);
				} else if (inToken[i] === "-" && i < inToken.length - 2) {
					var first = outToken.operands.pop();
					var last = inToken[i + 1];
					var range = {tokenType: "range", from: first, to: last};
					outToken.operands.push(range);
					i++;
				} else {
					outToken.operands.push(inToken[i]);
				}
			}
			return outToken;
		};

		this.parseQuantifier = function (inToken) {
			var outToken = {tokenType: "quantifier"};

			switch (inToken[0]) {
				case '?':
					outToḱen.min = 0;
					outToken.max = 1;
					break;
				case '*':
					outToken.min = 0;
					outToken.max = this.PSEUDOINFINITY;
					break;
				case '+':
					outToken.min = 1;
					outToken.max = this.PSEUDOINFINITY;
					break;
				case '{':
					if (!this.BRACE_QUANTIFIER_REGEX.test(inToken)) throw "That's a stupid quantifier and you're stupid, stupid.";
					
					// TODO Add some fuck*ng error handling here. :\
					var subTokens = inToken.match(/,|[0-9]+/g);
					outToken.min = subTokens[0];
					outToken.max = (subTokens.length === 2 ? this.PSEUDOINFINITY : subTokens[subTokens.length - 1]); // Clear as day. ^_^
					break;
				default:
					throw "Invalid quantifier, somehow: " + inToken;
			}

			if (inToken.length > 1) {
				switch (inToken[inToken.length - 1]) {
					case '?':
						outToken.lazy = true;
						break;
					case '+':
						outToken.greedy = true;
						break;
				}
			}

			return outToken;
		};
		
		this.parseEscapedCharacter = function (inToken) {
			switch (inToken[1]) {
				case 'd':
					return {tokenType: "or", operands: this.DIGIT_CLASS};
				case 'D':
					return {tokenType: "nor", operands: this.DIGIT_CLASS};
				case 'n':
					return {tokenType: "literal", content: '\n'};
				case 's':
					return {tokenType: "or", operands: this.WHITESPACE_CLASS};
				case 'S':
					return {tokenType: "nor", operands: this.WHITESPACE_CLASS};
				case 't':
					return {tokenType: "literal", content: '\t'};
				case 'w':
					return {tokenType: "or", operands: this.WORD_CLASS};
				case 'W':
					return {tokenType: "nor", operands: this.WORD_CLASS};
				default:
					return {tokenType: "literal", content: inToken[1]};
			}
		};
		
		this.parseOutput = function () {
			var regexString = document.getElementById("regex").value;
			var regexStructure = this.parse(regexString);
			window.debugStructure = regexStructure;
			document.getElementById("structureOutput").innerHTML = this.prettyPrint(regexStructure, 0);
		};
		
		this.prettyPrint = function (structure, level) {
			var outString = "";
			if (typeof structure === "object") {
				if (structure[0]) {
					outString += "[";
					for (var i = 0; i < structure.length; i++) {
						outString += this.prettyPrint(structure[i], level + 1) + ", ";
					}
					outString += "]";
				} else {
					if (structure.tokenType === "literal" && !structure.multiplicity) {
						outString += structure.content;
					} else {
						outString += "{";
						for (var k in structure) {
							outString += k + ": ";
							outString += this.prettyPrint(structure[k], level + 1) + ", ";
						}
						outString += "}";
					}
				}
			} else {
				outString += "\"" + structure + "\"?!!";
			}
			return outString;
		};
		
		this.generateExample = function (structure) {
			var example = "";
			for (var i = 0; i < structure.length; i++) {
				var token = structure[i];
				if (token[0]) {
					example += this.generateExample(token);
				}
				var multiplicity = 1;
				if (token.multiplicity) {
					var min = token.multiplicity.min;
					var max = token.multiplicity.max;
					multiplicity = min + Math.floor(Math.random() * (max - min + 1));
				}
				for (var j = 0; j < multiplicity; j++) {
					switch (token.tokenType) {
						case "literal":
							example += token.content;
							break;
						case "wildcard":
							example += String.fromCharCode(Math.floor(Math.random() * 256));
							break;
						default:
							// not yet implemented
					}
				}	
			}
			
			return example;
		};
		
	};
	
	window.ReverseRegexThing = ReverseRegexThing;
}());