async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

function csvJSON(filename) {
    let csv = fs.readFileSync(filename).toString();
    var lines = csv.split("\n");

    var result = [];
    var headers = lines[0].split(",");
    for (var i = 1; i < lines.length; i++) {
        var obj = {};
        var currentline = lines[i].split(",");

        for (var j = 0; j < headers.length; j++) {
            obj[headers[j]] = currentline[j];
        }

        result.push(obj);
    }
    return JSON.stringify(result).toString(); //JSON
}

module.exports = {
    sleep,
    csvJSON
}