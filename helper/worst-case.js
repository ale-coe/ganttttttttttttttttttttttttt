const { writeFileSync, readFileSync } = require("fs");

// const makeCode = (length = 6) =>
//   Array.from({ length }, () =>
//     Math.floor(Math.random() * 36)
//       .toString(36)
//       .toUpperCase()
//   ).join("");

// let arr = Array(300).fill(null);
// arr = arr.map(() => makeCode());
// writeFileSync("code.json", JSON.stringify(arr));

const arr = JSON.parse(readFileSync("code.json", { encoding: "utf8" }));
const connections = [];

for (let i = 0; i < arr.length - 1; i++) {
  for (let j = i + 1; j < arr.length; j++) {
    connections.push([arr[i], arr[j]]);
  }
}

const start = performance.now();
const tree = {};

for (let connection of connections) {
  const [parent, child] = connection;
  if (!tree[parent]) {
    tree[parent] = {};
  }
  if (!tree[child]) {
    tree[child] = {};
  }
  tree[parent][child] = tree[child];
}
console.log((performance.now() - start) / 1000);

// writeFileSync("test.json", JSON.stringify({ RNJBOI: tree["RNJBOI"] }));

const key = "2LGS45";
const subTree = { [key]: tree[key] };
const elements = Object.values(subTree);
const levelMapping = {};

let i = 0;
while (elements.length) {
  console.log(i);
  const value = elements.shift();
  const entries = Object.entries(value);

  for (const [key, _value] of entries) {
    levelMapping[key] = i;
    elements.push(_value);
  }

  i++;
}

console.log((performance.now() - start) / 1000);
// console.log(levelMapping);
