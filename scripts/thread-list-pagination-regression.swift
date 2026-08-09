import Foundation

enum ThreadListRegressionFailure: Error {
  case assertion(String)
}

func threadListRequire(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw ThreadListRegressionFailure.assertion(message) }
}

@main
struct ThreadListPaginationRegression {
  static func main() throws {
    let pages: [[String: Any]] = [
      ["data": [["id": "thread-a"]], "nextCursor": "page-2"],
      ["data": [["id": "thread-subagent", "parentThreadId": "thread-a"]], "nextCursor": NSNull()]
    ]
    var cursors: [String?] = []
    var index = 0
    let result = try collectCodexThreadListPages(initialParams: [
      "archived": false,
      "useStateDbOnly": true,
      "sortKey": "updated_at",
      "sortDirection": "desc"
    ]) { params in
      try threadListRequire(params["useStateDbOnly"] as? Bool == true, "thread/list must use the canonical state database overview")
      try threadListRequire(params["sortKey"] as? String == "updated_at", "thread/list must sort by canonical updated_at")
      try threadListRequire(params["sortDirection"] as? String == "desc", "thread/list must show newest threads first")
      cursors.append(params["cursor"] as? String)
      defer { index += 1 }
      return pages[index]
    }
    let threads = result["data"] as? [[String: Any]] ?? []
    try threadListRequire(cursors.count == 2, "thread/list must fetch every page")
    try threadListRequire(cursors[0] == nil && cursors[1] == "page-2", "thread/list must forward cursor")
    try threadListRequire(threads.count == 2, "thread/list must merge pages")
    try threadListRequire(threads[1]["parentThreadId"] as? String == "thread-a", "thread/list must preserve subagent lineage")
    try threadListRequire(result["nextCursor"] is NSNull, "thread/list aggregate must terminate at null")

    var repeatedCalls = 0
    do {
      _ = try collectCodexThreadListPages(initialParams: [:]) { _ in
        repeatedCalls += 1
        return ["data": [], "nextCursor": "repeat"]
      }
      throw ThreadListRegressionFailure.assertion("repeated cursor must fail")
    } catch BridgeError.invalidPayload {
      try threadListRequire(repeatedCalls == 2, "repeated cursor must be detected on the second page")
    }

    print("{\"status\":\"thread_list_pagination_regression_passed\",\"threads\":2}")
  }
}
