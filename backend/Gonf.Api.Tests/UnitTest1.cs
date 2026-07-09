using System.Text.Json;
using Gonf.Api.Services;

namespace Gonf.Api.Tests;

public class JsonSchemaPreviewServiceTests
{
        [Fact]
        public void Build_InfersFlatObjectPrimitiveTypes()
        {
                var root = ParseRoot(
                        """
                        {
                            "firstName": "Ava",
                            "age": 31,
                            "monthlyAmount": 12.75,
                            "isActive": true
                        }
                        """
                );

                var nodes = JsonSchemaPreviewService.Build(root);

                Assert.Contains(nodes, n => n.Path == "firstName" && n.InferredType == "string");
                Assert.Contains(nodes, n => n.Path == "age" && n.InferredType == "number");
                Assert.Contains(nodes, n => n.Path == "monthlyAmount" && n.InferredType == "decimal");
                Assert.Contains(nodes, n => n.Path == "isActive" && n.InferredType == "boolean");
        }

        [Fact]
        public void Build_ProducesNestedObjectPaths()
        {
                var root = ParseRoot(
                        """
                        {
                            "customer": {
                                "profile": {
                                    "createdAt": "2026-07-08T12:00:00Z"
                                }
                            }
                        }
                        """
                );

                var nodes = JsonSchemaPreviewService.Build(root);

                Assert.Contains(nodes, n => n.Path == "customer" && n.InferredType == "object" && n.IsObject);
                Assert.Contains(nodes, n => n.Path == "customer.profile" && n.InferredType == "object" && n.IsObject);
                Assert.Contains(nodes, n => n.Path == "customer.profile.createdAt" && n.InferredType == "date");
        }

        [Fact]
        public void Build_SupportsRootArrayOfObjectsAsRepeatableGroup()
        {
                var root = ParseRoot(
                        """
                        [
                            { "name": "Ava", "score": 7 },
                            { "name": "Ben", "score": 9 }
                        ]
                        """
                );

                var nodes = JsonSchemaPreviewService.Build(root);

                Assert.Contains(nodes, n => n.Path == "$" && n.IsArray && n.IsObject && n.InferredType == "object");
                Assert.Contains(nodes, n => n.Path == "$[*].name" && n.InferredType == "string");
                Assert.Contains(nodes, n => n.Path == "$[*].score" && n.InferredType == "number");
        }

        [Fact]
        public void Build_UsesConfiguredNullFallbackTypeHints()
        {
                var root = ParseRoot(
                        """
                        {
                            "birthDate": null,
                            "totalAmount": null,
                            "userId": null,
                            "nickname": null
                        }
                        """
                );

                var nodes = JsonSchemaPreviewService.Build(root);

                Assert.Contains(nodes, n => n.Path == "birthDate" && n.InferredType == "date");
                Assert.Contains(nodes, n => n.Path == "totalAmount" && n.InferredType == "decimal");
                Assert.Contains(nodes, n => n.Path == "userId" && n.InferredType == "number");
                Assert.Contains(nodes, n => n.Path == "nickname" && n.InferredType == "string");
        }

        [Fact]
        public void Build_UsesRepeatableFieldForPrimitiveArrays()
        {
                var root = ParseRoot(
                        """
                        {
                            "tags": ["one", "two", "three"]
                        }
                        """
                );

                var nodes = JsonSchemaPreviewService.Build(root);

                Assert.Contains(nodes, n => n.Path == "tags" && n.IsArray && !n.IsObject && n.InferredType == "string");
        }

        private static JsonElement ParseRoot(string json)
        {
                using var document = JsonDocument.Parse(json);
                return document.RootElement.Clone();
        }
}
