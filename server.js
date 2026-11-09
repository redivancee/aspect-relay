import { exec } from "child_process"
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs"
import { createServer } from "http"
import { randomBytes } from "crypto"

async function installLune() {
    if (existsSync("./lute")) {
        console.log("lute already exists")
        return
    }
    console.log("downloading lute...")
    await new Promise((resolve, reject) => {
        exec(
            "curl -L https://github.com/luau-lang/lute/releases/download/v1.0.0/lute-linux-x86_64.zip -o lute.zip && unzip -o lute.zip && chmod +x ./lute && rm lute.zip",
            (err, stdout, stderr) => {
                console.log("install stdout:", stdout)
                console.log("install stderr:", stderr)
                if (err) reject(err)
                else resolve()
            }
        )
    })
    console.log("lute installed, exists:", existsSync("./lute"))
}

await installLune()

createServer(async (req, res) => {
    if (req.url === "/debug") {
        exec("ls -la && find / -name 'parser.luau' 2>/dev/null | head -20 && ./lute --version", (err, stdout, stderr) => {
            res.writeHead(200)
            res.end(JSON.stringify({ stdout, stderr, luneExists: existsSync("./lute") }))
        })
        return
    }

    if (req.url === "/parse") {
    let body = ""
    req.on("data", d => body += d)
    req.on("end", () => {
        const id = randomBytes(8).toString("hex")
        const inPath = `/tmp/${id}_in.lua`
        const outPath = `/tmp/${id}_out.txt`
        writeFileSync(inPath, "local x = 1\nif x > 0 then\n    print('hi')\nend")
        exec(
            `./lute run debug_parse.luau -- ${inPath} ${outPath}`,
            (err, stdout, stderr) => {
                let result
                try { result = readFileSync(outPath, "utf8") } catch { result = null }
                try { unlinkSync(inPath) } catch {}
                try { unlinkSync(outPath) } catch {}
                res.writeHead(200)
                res.end(JSON.stringify({ result, stdout, stderr }))
            }
        )
    })
    return
}

    if (req.method !== "POST") return res.end("only POST")

    let body = ""
    req.on("data", d => body += d)
    req.on("end", () => {
        let parsed
        try { parsed = JSON.parse(body) } catch {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: "invalid json" }))
        }

        const { script, callId, constantCollection } = parsed
        if (!script) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: "no script" }))
        }

        const id = randomBytes(8).toString("hex")
        const inPath = `/tmp/${id}_in.lua`
        const outPath = `/tmp/${id}_out.lua`

        writeFileSync(inPath, script)

        exec(
            `./lute run unparser.luau -- ${inPath} ${outPath} ${callId || "0"} ${constantCollection ? "1" : ""}`,
            (err, stdout, stderr) => {
                let result
                try { result = readFileSync(outPath, "utf8") } catch { result = null }
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
}).listen(process.env.PORT || 3000, () => console.log("running"))
