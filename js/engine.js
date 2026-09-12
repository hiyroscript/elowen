/* A bounded recursive-descent parser. No JavaScript source is executed. */
(function (root) {
  "use strict";
  function calculate(source, mode = "deg") {
    if (typeof source !== "string" || source.length > 2000)
      throw Error("Expression is too long.");
    const text = source
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/−/g, "-")
      .replace(/π/g, "pi")
      .trim();
    const tokens = [];
    let pos = 0;
    while (pos < text.length) {
      if (/\s/.test(text[pos])) {
        pos++;
        continue;
      }
      const match = text
        .slice(pos)
        .match(
          /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|^[a-zA-Z]+|^[+\-*/^()%!]/,
        );
      if (!match)
        throw Error("Use numbers, operators, and supported functions.");
      tokens.push(match[0]);
      pos += match[0].length;
    }
    let i = 0,
      depth = 0;
    const peek = () => tokens[i];
    const finite = (value) => {
      if (!Number.isFinite(value))
        throw Error("Result is outside the supported real-number range.");
      return Object.is(value, -0) ? 0 : value;
    };
    function call(name, value) {
      const angle = mode === "deg" ? (value * Math.PI) / 180 : value;
      const inverse = (result) =>
        mode === "deg" ? (result * 180) / Math.PI : result;
      switch (name) {
        case "sqrt":
          if (value < 0)
            throw Error("Square root needs a non-negative number.");
          return Math.sqrt(value);
        case "abs":
          return Math.abs(value);
        case "ln":
        case "log":
          if (value <= 0) throw Error("Logarithms need a positive number.");
          return name === "ln" ? Math.log(value) : Math.log10(value);
        case "exp":
          return finite(Math.exp(value));
        case "sin":
          return Math.sin(angle);
        case "cos":
          return Math.cos(angle);
        case "tan":
          if (Math.abs(Math.cos(angle)) < 1e-14)
            throw Error("Tangent is undefined at this angle.");
          return Math.tan(angle);
        case "asin":
        case "acos":
          if (Math.abs(value) > 1)
            throw Error("Inverse sine and cosine need a value from −1 to 1.");
          return inverse(name === "asin" ? Math.asin(value) : Math.acos(value));
        case "atan":
          return inverse(Math.atan(value));
        default:
          throw Error("Unknown function: " + name);
      }
    }
    function primary() {
      if (++depth > 100) throw Error("Expression is too deeply nested.");
      let value,
        token = tokens[i++];
      if (token === "(") {
        value = sum();
        if (tokens[i++] !== ")") throw Error("Close each parenthesis.");
      } else if (token === "pi") value = Math.PI;
      else if (token === "e") value = Math.E;
      else if (token && /^[\d.]/.test(token)) value = finite(Number(token));
      else if (token && /^[a-zA-Z]+$/.test(token)) {
        if (tokens[i++] !== "(")
          throw Error("Functions need parentheses, for example sin(30).");
        const argument = sum();
        if (tokens[i++] !== ")")
          throw Error("Close each function parenthesis.");
        value = call(token.toLowerCase(), argument);
      } else throw Error("Complete the expression with a number.");
      while (peek() === "!" || peek() === "%") {
        if (tokens[i++] === "%") value /= 100;
        else {
          if (!Number.isInteger(value) || value < 0 || value > 170)
            throw Error("Factorial needs a whole number from 0 to 170.");
          let product = 1;
          for (let n = 2; n <= value; n++) product *= n;
          value = product;
        }
      }
      depth--;
      return finite(value);
    }
    function power() {
      const left = primary();
      if (peek() === "^") {
        i++;
        return finite(left ** unary());
      }
      return left;
    }
    function unary() {
      if (++depth > 100) throw Error("Expression is too deeply nested.");
      let value;
      if (peek() === "+" || peek() === "-") {
        const sign = tokens[i++];
        value = (sign === "-" ? -1 : 1) * unary();
      } else value = power();
      depth--;
      return value;
    }
    function product() {
      let left = unary();
      while (true) {
        const token = peek();
        const implicit = token && (token === "(" || /^[a-zA-Z]/.test(token));
        if (token !== "*" && token !== "/" && !implicit) break;
        if (!implicit) i++;
        const right = unary();
        if (token === "/" && right === 0) throw Error("Cannot divide by zero.");
        left = finite(token === "/" ? left / right : left * right);
      }
      return left;
    }
    function sum() {
      let left = product();
      while (peek() === "+" || peek() === "-") {
        const op = tokens[i++],
          right = product();
        left = finite(op === "+" ? left + right : left - right);
      }
      return left;
    }
    if (!tokens.length) throw Error("Enter a calculation first.");
    const result = sum();
    if (i !== tokens.length)
      throw Error("Check the operators and parentheses.");
    return finite(result);
  }
  const format = (value) => Number(value.toPrecision(12)).toString();
  const api = { calculate, format };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ElowenMath = api;
})(globalThis);
