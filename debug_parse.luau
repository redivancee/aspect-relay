local parser = require("@std/syntax/parser")
local fs = require("@std/fs")

local args = {...}

local source = fs.readFile(args[1])
local result = parser.parse(source)

local visited = {}
local function dump(val, depth)
    depth = depth or 0
    if depth > 6 then return "..." end
    local indent = string.rep("  ", depth)
    local t = typeof(val)
    if t == "table" then
        if visited[val] then return "{ recursive }" end
        visited[val] = true
        local out = "{\n"
        for k, v in next, val do
            out = out .. indent .. "  [" .. tostring(k) .. "] = " .. dump(v, depth + 1) .. "\n"
        end
        visited[val] = nil
        return out .. indent .. "}"
    end
    return tostring(val)
end

fs.writeFile(args[2], dump(result))
