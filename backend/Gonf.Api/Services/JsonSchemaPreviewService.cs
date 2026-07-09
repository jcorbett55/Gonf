using System.Text.Json;
using Gonf.Api.Models;

namespace Gonf.Api.Services;

public static class JsonSchemaPreviewService
{
    private const string StringType = "string";

    public static List<SchemaNode> Build(JsonElement root)
    {
        var nodes = new List<SchemaNode>();
        BuildElement(root, "$", "root", nodes);
        return nodes;
    }

    private static void BuildElement(JsonElement element, string path, string fieldName, List<SchemaNode> nodes)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                if (path != "$")
                {
                    nodes.Add(new SchemaNode(path, fieldName, "object", false, true));
                }

                foreach (var property in element.EnumerateObject())
                {
                    var childPath = path == "$" ? property.Name : $"{path}.{property.Name}";
                    BuildElement(property.Value, childPath, property.Name, nodes);
                }
                break;

            case JsonValueKind.Array:
                BuildArray(element, path, fieldName, nodes);
                break;

            default:
                nodes.Add(new SchemaNode(path, fieldName, InferType(element, fieldName), false, false));
                break;
        }
    }

    private static void BuildArray(JsonElement array, string path, string fieldName, List<SchemaNode> nodes)
    {
        var firstMeaningful = array.EnumerateArray().FirstOrDefault(item => item.ValueKind != JsonValueKind.Null);

        if (firstMeaningful.ValueKind == JsonValueKind.Object)
        {
            nodes.Add(new SchemaNode(path, fieldName, "object", true, true));
            foreach (var property in firstMeaningful.EnumerateObject())
            {
                BuildElement(property.Value, $"{path}[*].{property.Name}", property.Name, nodes);
            }
            return;
        }

        if (firstMeaningful.ValueKind == JsonValueKind.Array)
        {
            nodes.Add(new SchemaNode(path, fieldName, "array", true, false));
            return;
        }

        if (firstMeaningful.ValueKind == JsonValueKind.Undefined)
        {
            nodes.Add(new SchemaNode(path, fieldName, StringType, true, false));
            return;
        }

        var inferredType = firstMeaningful.ValueKind == JsonValueKind.Null
            ? InferNullType(fieldName)
            : InferType(firstMeaningful, fieldName);

        nodes.Add(new SchemaNode(path, fieldName, inferredType, true, false));
    }

    private static string InferType(JsonElement element, string fieldName)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.TryGetDateTime(out _) ? "date" : "string",
            JsonValueKind.Number => InferNumericType(element),
            JsonValueKind.True or JsonValueKind.False => "boolean",
            JsonValueKind.Object => "object",
            JsonValueKind.Array => "array",
            JsonValueKind.Null => InferNullType(fieldName),
            _ => StringType
        };
    }

    private static string InferNumericType(JsonElement element)
    {
        var raw = element.GetRawText();
        return raw.Contains('.') || raw.Contains('e') || raw.Contains('E') ? "decimal" : "number";
    }

    // Nulls are mapped by field-name hints for this sprint's fallback defaults.
    private static string InferNullType(string fieldName)
    {
        var normalized = fieldName.ToLowerInvariant();

        if (normalized.Contains("date") || normalized.Contains("time") || normalized.EndsWith("at"))
        {
            return "date";
        }

        if (normalized.Contains("amount") || normalized.Contains("price") || normalized.Contains("total") ||
            normalized.Contains("cost") || normalized.Contains("rate") || normalized.Contains("balance"))
        {
            return "decimal";
        }

        if (normalized.Contains("count") || normalized.Contains("num") || normalized.Contains("qty") ||
            normalized.Contains("quantity") || normalized.Contains("age") || normalized.EndsWith("id"))
        {
            return "number";
        }

        return StringType;
    }
}