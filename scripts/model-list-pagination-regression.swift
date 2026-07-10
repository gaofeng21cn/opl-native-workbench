import Foundation

enum RegressionFailure: Error {
  case assertion(String)
}

func require(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw RegressionFailure.assertion(message) }
}

@main
struct ModelListPaginationRegression {
  static func main() throws {
    let pages: [[String: Any]] = [
      [
        "data": [[
          "id": "gpt-5.6-sol",
          "isDefault": false,
          "supportedReasoningEfforts": [["reasoningEffort": "high"], ["reasoningEffort": "xhigh"]]
        ]],
        "nextCursor": "page-2"
      ],
      [
        "data": [[
          "id": "gpt-6",
          "displayName": "GPT-6",
          "isDefault": true,
          "defaultReasoningEffort": "high",
          "supportedReasoningEfforts": [
            ["reasoningEffort": "low"],
            ["reasoningEffort": "high"],
            ["reasoningEffort": "xhigh"],
            ["reasoningEffort": "max"]
          ]
        ]],
        "nextCursor": NSNull()
      ]
    ]
    var requestedCursors: [String?] = []
    var pageIndex = 0

    let catalog = try collectCodexModelListPages { cursor in
      requestedCursors.append(cursor)
      defer { pageIndex += 1 }
      return pages[pageIndex]
    }

    let models = catalog["data"] as? [[String: Any]] ?? []
    try require(requestedCursors.count == 2, "must fetch until nextCursor is null")
    try require(requestedCursors[0] == nil, "first page must omit cursor")
    try require(requestedCursors[1] == "page-2", "second page must use the advertised cursor")
    try require(models.count == 2, "must merge models from both pages")
    try require(models[1]["id"] as? String == "gpt-6", "must retain the second-page GPT-6 model")
    try require(models[1]["isDefault"] as? Bool == true, "must retain the second-page default marker")
    let reasoning = models[1]["supportedReasoningEfforts"] as? [[String: Any]] ?? []
    let highestReasoning = reasoning.last?["reasoningEffort"] as? String
    try require(highestReasoning == "max", "must retain ordered schema-shaped reasoning options")
    try require(catalog["nextCursor"] is NSNull, "merged catalog must be terminal")

    print("{\"status\":\"model_list_pagination_regression_passed\",\"models\":2,\"highest_reasoning_effort\":\"max\"}")
  }
}
