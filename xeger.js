(function () {
	
	var ReverseRegexThing = function () {
		this.REGEX_TOKEN_REGEX = /\\.|\((?:\?.)?|\)|\^|\$|\[\^?(?:\\.|[^\]])+\]|[\?\*\+][\?\+]?|\{\d+(?:,(?:\d+))?\}|\.|[^\\\.\?\*\+\(\)\{\}\[\]\^\$]+/g;
		this.BRACE_QUANTIFIER_REGEX = /^\{\d+(?:,(?:\d+))?\}$/;

		// Since some of the quantifiers permit arbitrarily large numbers, let's pick a reasonably big one and go with that.
		this.INFINITY = 100;

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
			var outToken = {};
			if (inToken[0] === "[") {
				outToken = this.parseBracketClass(inToken);
			} else if (inToken[0] === "\\") {
				outToken = this.parseEscapedCharacter(inToken);
			} else if (inToken[0] === "?" || inToken[0] === "*" || inToken[0] === "+" || inToken[0] === "{") {
				outToken = this.parseQuantifier(inToken);
			} else if (inToken === "^") {
				outToken.tokenType = "start";
			} else if (inToken === "$") {
				outToken.tokenType = "end";
			} else if (inToken[0] === ".") {
				outToken.tokenType = "wildcard";
			} else {
				outToken.tokenType = "literal";
				outToken.content = inToken;
			}
			return outToken;
		};

		this.parseBracketClass = function (inToken) {
			var outToken = {tokenType: "or", operands: []};
			var startIndex = 1;
			if (inToken[startIndex] === "^") {
				startIndex ++;
				outToken.tokenType = "nor";
			}
			if (inToken[startIndex] === "-") {
				startIndex ++;
				outToken.operands.push("-");
			}
			for (var i = startIndex; i < inToken.length - 1; i++) {
				if (inToken[i] === "\\") {
					i ++;
					outToken.operands.push(inToken[i]);
				} else if (inToken[i] === "-" && i < inToken.length - 2) {
					var first = outToken.operands.pop();
					var last = inToken[i + 1];
					var range = {tokenType: "range", from: first, to: last};
					outToken.operands.push(range);
					i ++;
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
					outToken.max = this.INFINITY;
					break;
				case '+':
					outToken.min = 1;
					outToken.max = this.INFINITY;
					break;
				case '{':
					if (!this.BRACE_QUANTIFIER_REGEX.test()) throw "That's a stupid quantifier and you're stupid, stupid.";
					
					// TODO Add some fuck*ng error handling here. :\
					var subTokens = inToken.match(/,|[0-9]+/g);
					outToken.min = subTokens[0];
					outToken.max = (subTokens.length === 2 ? this.INFINITY : subTokens[subTokens.length - 1]); // Clear as day. ^_^
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
				}
			}

			return outToken;
		};
		
		this.parseEscapedCharacter = function (inToken) {
			var outToken = {};
			switch (inToken[1]) {
				case "s":
					outToken = {tokenType: "or", operands: this.WHITESPACE_CLASS};
					break;
				case 'S':
					outToken = {tokenType: "nor", operands: this.WHITESPACE_CLASS};
					break;
				case "t":
					outToken = {tokenType: "literal", content: '\t'};
					break;
				case "n":
					outToken = {tokenType: "literal", content: '\n'};
					break;
				default:
					outToken = {tokenType: "literal", content: inToken[1]};
			}
			return outToken;
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
				outString += "\"" + structure + "\"";
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