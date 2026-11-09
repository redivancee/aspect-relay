local parser = require("@std/syntax/parser")
local fs = require("@std/fs")

local args = {...}
local source = fs.readfile(args[1])
local result = parser.parse(source)

local function dump(val, depth)
    depth = depth or 0
    local indent = string.rep("  ", depth)
    local t = typeof(val)
    if t == "table" then
        local out = "{\n"
        for k, v in next, val do
            out = out .. indent .. "  [" .. tostring(k) .. "] = " .. dump(v, depth + 1) .. "\n"
        end
        return out .. indent .. "}"
    end
    return tostring(val)
end

local handle = fs.open(args[2], "w")
fs.write(handle, dump(result))
fs.close(handle)
