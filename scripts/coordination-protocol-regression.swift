import Foundation

enum CoordinationRegressionFailure: Error {
  case assertion(String)
}

func coordinationRequire(_ condition: @autoclosure () -> Bool, _ message: String) throws {
  if !condition() { throw CoordinationRegressionFailure.assertion(message) }
}

@main
struct CoordinationProtocolRegression {
  static func main() throws {
    let pages: [[String: Any]] = [
      ["data": [["id": "thread-a"]], "nextCursor": "page-2"],
      ["data": [["id": "thread-b"]], "nextCursor": NSNull()]
    ]
    var cursors: [String?] = []
    var index = 0
    let result = try collectCodexThreadListPages(initialParams: ["archived": false]) { params in
      cursors.append(params["cursor"] as? String)
      defer { index += 1 }
      return pages[index]
    }
    let threads = result["data"] as? [[String: Any]] ?? []
    try coordinationRequire(cursors.count == 2, "thread/list must fetch every page")
    try coordinationRequire(cursors[0] == nil && cursors[1] == "page-2", "thread/list must forward cursor")
    try coordinationRequire(threads.count == 2, "thread/list must merge pages")
    try coordinationRequire(result["nextCursor"] is NSNull, "thread/list aggregate must terminate at null")

    var repeatedCalls = 0
    do {
      _ = try collectCodexThreadListPages(initialParams: [:]) { _ in
        repeatedCalls += 1
        return ["data": [], "nextCursor": "repeat"]
      }
      throw CoordinationRegressionFailure.assertion("repeated cursor must fail closed")
    } catch BridgeError.invalidPayload {
      try coordinationRequire(repeatedCalls == 2, "repeated cursor must be detected on second page")
    }

    print("{\"status\":\"coordination_protocol_regression_passed\",\"threads\":2}")
  }
}
