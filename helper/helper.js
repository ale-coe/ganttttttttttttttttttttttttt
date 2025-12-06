const fs = require("fs");
const data = fs.readFileSync("start.txt", { encoding: "utf8" }).split("\n");

let startDate = null;

// setting startIndexX has small issue at several places
for (let i = 0; i < data.length; i++) {
  const line = data[i].trim();
  if (line.startsWith("startDate")) {
    const itemStartDate = +line.match(/startDate:\s*(\d+)/)[1];
    if (!startDate) {
      startDate = itemStartDate;
    }
    const index = Math.ceil(
      (itemStartDate - startDate) / (24 * 60 * 60 * 1000)
    );

    data[i] += `startIndexX: ${index},`;
  }
}

fs.writeFileSync("end.txt", data.join("\n"));
