import { exec } from "child_process"
import { writeFileSync, readFileSync, unlinkSync } from "fs"
import { createServer } from "http"
import { randomBytes } from "crypto"

createServer(async (req, res) => {
    if (req.method !== "POST") return res.end("only POST")

    let body = ""
    req.on("data", d => body += d)
    req.on("end", () => {
        const { script, callId, constantCollection } = JSON.parse(body)

        const id = randomBytes(8).toString("hex")
        const inPath = `/tmp/${id}_in.lua`
        const outPath = `/tmp/${id}_out.lua`

        writeFileSync(inPath, script)

        // lune run unparser.luau -- _ <input> <output> <callId> <constantCollection>
        exec(
            `lune run unparser.luau -- _ ${inPath} ${outPath} ${callId || "0"} ${constantCollection ? "1" : ""}`,
            (err, stdout, stderr) => {
                let result
                try {
                    result = readFileSync(outPath, "utf8")
                } catch {
                    result = null
                }

                try { unlinkSync(inPath) } catch {}
                try { unlinkSync(outPath) } catch {}

                if (err || !result) {
                    res.writeHead(500)
                    return res.end(JSON.stringify({ error: stderr || err?.message }))
                }

                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ script: result }))
            }
        )
    })
}).listen(3000, () => console.log("running on 3000"))
