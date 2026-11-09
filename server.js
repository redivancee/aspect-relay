
import { execFile } from "child_process"
import {
    writeFileSync,
    readFileSync,
    unlinkSync,
    existsSync
} from "fs"
import { createServer } from "http"
import { randomBytes } from "crypto"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

async function installLute() {
    if (existsSync("./lute")) return

    console.log("Downloading Lute...")

    await execFileAsync("bash", ["-c",
        "curl -L https://github.com/luau-lang/lute/releases/download/v1.0.0/lute-linux-x86_64.zip -o lute.zip && unzip -o lute.zip && chmod +x ./lute && rm lute.zip"
    ])

    console.log("Lute installed:", existsSync("./lute"))
}

await installLute()

async function runLute(script, mode, options = {}) {
    const id = randomBytes(8).toString("hex")
    const input = `/tmp/${id}_in.lua`
    const output = `/tmp/${id}_out.lua`

    try {
        writeFileSync(input, script)

        const args = mode === "parse"
            ? ["run", "debug_parse.luau", input, output]
            : [
                "run",
                "unparser.luau",
                input,
                output,
                options.callId || "0",
                options.constantCollection ? "1" : ""
            ]

        const { stdout, stderr } = await execFileAsync("./lute", args, {
            timeout: 30000,
            maxBuffer: 5 * 1024 * 1024
        })

        const result = readFileSync(output, "utf8")

        return { result, stdout, stderr }
    } finally {
        try { unlinkSync(input) } catch {}
        try { unlinkSync(output) } catch {}
    }
}

createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json")

    if (req.method === "GET" && req.url === "/debug") {
        return res.end(JSON.stringify({
            luteExists: existsSync("./lute"),
            unparserExists: existsSync("./unparser.luau"),
            parserExists: existsSync("./debug_parse.luau")
        }))
    }

    if (req.method !== "POST") {
        res.writeHead(405)
        return res.end(JSON.stringify({ error: "POST required" }))
    }

    let body = ""

    try {
        for await (const chunk of req) {
            body += chunk
            if (body.length > 2 * 1024 * 1024) {
                res.writeHead(413)
                return res.end(JSON.stringify({ error: "Request too large" }))
            }
        }

        const parsed = JSON.parse(body)
        const { script, callId, constantCollection } = parsed

        if (typeof script !== "string" || !script.trim()) {
            res.writeHead(400)
            return res.end(JSON.stringify({ error: "Missing script" }))
        }

        const mode = req.url === "/parse" ? "parse" : "unparse"
        const result = await runLute(script, mode, {
            callId,
            constantCollection
        })

        res.writeHead(200)
        res.end(JSON.stringify({
            success: true,
            ...(mode === "parse"
                ? { result: result.result }
                : { script: result.result }),
            stdout: result.stdout,
            stderr: result.stderr
        }))

    } catch (err) {
        res.writeHead(500)
        res.end(JSON.stringify({
            error: err.message,
            stderr: err.stderr || ""
        }))
    }
}).listen(process.env.PORT || 3000, () => {
    console.log("Aspect Relay running")
})
