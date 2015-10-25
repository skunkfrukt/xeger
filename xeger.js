(function () {

	var Range = function (min, max) {
		if (this.min > this.max) {
			throw "Invalid range: " + min + ", " + max;
		}
		this.min = (typeof min === "number" ? min : min.charCodeAt());
		this.max = (typeof max === "number" ? max : max.charCodeAt());
	};

	Range.prototype.expand = function() {
		var values = [];

		for (var i = this.min; i <= this.max; i++) {
			values.push(i);
		}

		return values;
	};

	window.Range = Range;

	var CharacterClass = function (isPositive /*...*/) {
		this.isPositive = isPositive;
		this.items = {};
		this.size = 0;

		for (var i = 1; i < arguments.length; i++) {
			this.add(arguments[i]);
		}
	};

	CharacterClass.prototype.add = function (item) {
		if (typeof item === "string") {
			this.items[item.charCodeAt(0)] = true;
		} else if (typeof item === "number") {
			this.items[item] = true;
		} else if (item instanceof Range) {
			var chars = item.expand();
			for (var i = 0; i < chars.length; i++) {
				this.items[chars[i]] = true;
			}
		} else if (item instanceof CharacterClass) {
			var chars = item.getAllCharCodes();
			for (var i = 0; i < chars.length; i++) {
				this.items[chars[i]] = true;
			}
		}

		this.size = (this.isPositive ? Object.keys(this.items).length : 65536 - Object.keys(this.items).length);
	};

	CharacterClass.prototype.getAllCharCodes = function () {
		if (this.isPositive) {
			return Object.keys(this.items);
		} else {
			var charCodes = [];
			for (var i = 0; i < 65536; i++) {
				if (!this.items[i]) {
					charCodes.push(i);
				}
			}
		}
	};

	CharacterClass.prototype.inverse = function () {
		return new CharacterClass(!this.isPositive, this);
	};

	CharacterClass.prototype.getRandomCharacter = function () {
		var randomIndex = Math.floor(Math.random() * this.size);
		if (this.isPositive) {
			var randomCharCode = Object.keys(this.items).sort()[randomIndex];
			return String.fromCharCode(randomCharCode);
		} else {
			var excludedCharCodes = Object.keys(this.items).sort();
			for (var i = 0; i < excludedCharCodes.length; i++) {
				if (excludedCharCodes[i] <= randomIndex) {
					randomIndex++;
				} else {
					return String.fromCharCode(randomIndex);
				}
			}
		}
	};

	window.WILDCARD_CLASS = new CharacterClass(false);  // Negative class excluding nothing. Not confusing at all.
	window.DIGIT_CLASS = new CharacterClass(true, new Range('0', '9'));
	window.NON_DIGIT_CLASS = window.DIGIT_CLASS.inverse();
	window.WORD_CLASS = new CharacterClass(true, new Range('A', 'Z'), new Range('a', 'z'), new Range('0', '9'), '_');
	window.NON_WORD_CLASS = window.WORD_CLASS.inverse();
	window.WHITESPACE_CLASS = new CharacterClass(true, '\f', '\n', '\r', '\t', '\v', '\u00a0', '\u1680', '\u180e',
		new Range('\u2000', '\u200a'), '\u2028', '\u2029', '\u202f', '\u205f', '\u3000', '\ufeff');
	window.NON_WHITESPACE_CLASS = window.WHITESPACE_CLASS.inverse();

	window.CharacterClass = CharacterClass;

	var ReverseRegexThing = function () {
		this.REGEX_TOKEN_REGEX = /\\.|\((?:\?.)?|\)|\||\^|\$|\[\^?(?:\\.|[^\]])+\]|[\?\*\+][\?\+]?|\{\d+(?:,(?:\d+))?\}|\.|[^\\\.\?\*\+\(\)\{\}\[\]\^\$\|]+/g;
		this.BRACE_QUANTIFIER_REGEX = /^\{\d+(?:,(?:\d+))?\}$/;

		// Since some of the quantifiers permit arbitrarily large numbers, let's pick a reasonably big one and go with that.
		this.PSEUDOINFINITY = 100;

		this.WHITESPACE_CLASS = [' ', '\t'];
		
		this.parse = function (regex) {
			var tokens = regex.match(this.REGEX_TOKEN_REGEX);
			var structure = this.parseStructure(tokens, 0, 0).structure;
			
			return structure;
		};
		
		this.parseStructure = function(tokenArray, startIndex, parenthesisLevel) {
			var structure = {tokenType: "or", operands: [{tokenType: "and", operands: []}]};
			var substructure = structure.operands[0];
			
			for (var i = startIndex; i < tokenArray.length; i++) {
				var token = tokenArray[i];
				if (token[0] === "(") {
					var innerStructure = this.parseStructure(tokenArray, i + 1, parenthesisLevel + 1);
					substructure.operands.push(innerStructure.structure);
					i = innerStructure.lastIndex;
				} else if (token === ")" && parenthesisLevel > 0) {
					return {structure: structure, lastIndex: i};
				} else {
					var parsedToken = this.parseToken(token);
					if (parsedToken.tokenType === "pipe") {
						substructure = {tokenType: "and", operands: []};
						structure.operands.push(substructure);
					} else if (parsedToken.tokenType === "quantifier") {
						var modifiedToken = substructure.operands[substructure.operands.length - 1];
						if (modifiedToken.tokenType === "literal" && modifiedToken.content.length > 1) {
							var newToken = {
								tokenType: "literal",
								content: modifiedToken.content[modifiedToken.content.length - 1],
								multiplicity: parsedToken
							};
							modifiedToken.content = modifiedToken.content.substring(0, modifiedToken.content.length - 1);
							substructure.operands.push(newToken);
						} else {
							modifiedToken.multiplicity = parsedToken;
						}
					} else {
						substructure.operands.push(parsedToken);
					}
				}
			}
			
			if (parenthesisLevel > 0) throw "Unclosed parenthesis in expression!!!11";

			structure = this.flatten(structure);
			return {structure: structure, lastIndex: null};
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
					return {tokenType: "anchor", position: "start"};
				case '$':
					return {tokenType: "anchor", position: "end"};
				case '.':
					return {tokenType: "or", operands: ["ANYTHING!"]};
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
					outToken.min = 0;
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
					outToken.min = parseInt(subTokens[0]);
					outToken.max = parseInt(subTokens.length === 2 ? this.PSEUDOINFINITY : subTokens[subTokens.length - 1]); // Clear as day. ^_^
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
				case '0':
					return {tokenType: "literal", content: '\0'};
				case 'b':
					return {tokenType: "anchor", position: "word-boundary"};
				case 'B':
					return {tokenType: "anchor", position: "non-word-boundary"};
				case 'd':
					return {tokenType: "or", operands: this.DIGIT_CLASS};
				case 'D':
					return {tokenType: "nor", operands: this.DIGIT_CLASS};
				case 'f':
					return {tokenType: "literal", content: '\f'};
				case 'n':
					return {tokenType: "literal", content: '\n'};
				case 'r':
					return {tokenType: "literal", content: '\r'};
				case 's':
					return {tokenType: "or", operands: this.WHITESPACE_CLASS};
				case 'S':
					return {tokenType: "nor", operands: this.WHITESPACE_CLASS};
				case 't':
					return {tokenType: "literal", content: '\t'};
				case 'v':
					return {tokenType: "literal", content: '\v'};
				case 'w':
					return {tokenType: "or", operands: this.WORD_CLASS};
				case 'W':
					return {tokenType: "nor", operands: this.WORD_CLASS};
				case 'Z':
					return {tokenType: "anchor", position: "end"};
				default:
					return {tokenType: "literal", content: inToken[1]};
			}
		};

		this.flatten = function (structure) {
			var outStructure = structure;
			console.log("Flattening something...");
			while (outStructure.operands && outStructure.operands.length === 1) {
				outStructure = outStructure.operands[0];
			}
			if (outStructure.operands) {
				for (var i = 0; i < outStructure.operands.length; i++) {
					outStructure.operands[i] = this.flatten(outStructure.operands[i]);
				}
			}
			return outStructure;
		}
		
		this.parseFromTo = function (inputElementId, structureOutputElementId, exampleOutputElementId) {
			var inputElement = document.getElementById(inputElementId);
			var regexStructure = this.parse(inputElement.value);

			window.debugStructure = regexStructure;

			var structureOutputElement = document.getElementById(structureOutputElementId);
			structureOutputElement.innerHTML = this.prettyPrint(regexStructure, 0);

			var exampleOutputElement = document.getElementById(exampleOutputElementId);
			exampleOutputElement.innerHTML = this.generateExample(regexStructure);
		};
		
		this.prettyPrint = function (structure) {
			var outString = "";
			if (typeof structure === "object") {
				if (structure[0]) {
					outString += "<ol>";
					for (var i = 0; i < structure.length; i++) {
						outString += "<li>" + this.prettyPrint(structure[i]) + "</li>";
					}
					outString += "</ol>";
				} else {
					if (structure.tokenType === "literal") {
						outString += structure.content + (structure.multiplicity ? " {" + structure.multiplicity.min + "," + structure.multiplicity.max + "}" : "");
					} else {
						outString += "<dl>";
						outString += "<dt>" + structure.tokenType + (structure.multiplicity ? " {" + structure.multiplicity.min + "," + structure.multiplicity.max + "}" : "") + "</dt>";
						outString += "<dd>" + this.prettyPrint(structure.operands) + "</dd>";
						outString += "</dl>";
					}
				}
			} else {
				outString += "\"" + structure + "\"?!!";
			}
			return outString;
		};
		
		this.randomizeQuantifier = function (quantifierToken) {
			var span = quantifierToken.max - quantifierToken.min;
			
			return parseInt(quantifierToken.min) + Math.floor(Math.random() * (span + 1));
		};

		this.generateExample = function (structure) {
			var example = "";
			var quantifier = 1;

			if (structure.multiplicity) {
				quantifier = this.randomizeQuantifier(structure.multiplicity);
			}

			for (var m = 0; m < quantifier; m++) {
				switch (structure.tokenType) {
					case "and":
						for (var i = 0; i < structure.operands.length; i++) {
							example += this.generateExample(structure.operands[i]);
						}
						break;
					case "or":
						var operandIndex = Math.floor(Math.random() * structure.operands.length);
						example += this.generateExample(structure.operands[operandIndex]);
						break;
					case "literal":
						example += structure.content;
						break;
					default:
						example += structure;
				}
			}
			
			return example;
		};
		
	};
	
	window.ReverseRegexThing = ReverseRegexThing;
}());