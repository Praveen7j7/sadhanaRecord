import PDFKit
import Foundation
let a = CommandLine.arguments
guard let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("cannot open"); exit(1) }
let from = Int(a[2])!, to = min(Int(a[3])!, doc.pageCount)
print("pages:", doc.pageCount)
for i in (from-1)..<to { print("=== page \(i+1)"); print(doc.page(at: i)?.string ?? "<no text>") }
