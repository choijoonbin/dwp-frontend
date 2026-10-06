import Foundation
import Vision

struct OcrImage: Codable {
    let path: String
    let text: String
}

struct OcrResult: Codable {
    let schema: String
    let tool: String
    let toolVersion: String
    let recognitionLevel: String
    let languages: [String]
    let images: [OcrImage]
}

let paths = Array(CommandLine.arguments.dropFirst())
guard !paths.isEmpty else {
    FileHandle.standardError.write(Data("at least one image path is required\n".utf8))
    exit(2)
}

var images: [OcrImage] = []
for path in paths {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.recognitionLanguages = ["en-US", "ko-KR"]
    let handler = VNImageRequestHandler(url: URL(fileURLWithPath: path), options: [:])
    do {
        try handler.perform([request])
    } catch {
        FileHandle.standardError.write(Data("OCR failed for \(path): \(error)\n".utf8))
        exit(3)
    }
    let observations = request.results ?? []
    let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
    images.append(OcrImage(path: path, text: text))
}

let result = OcrResult(
    schema: "dwp.hris.g5a-image-ocr-runtime.v1",
    tool: "APPLE_VISION_VNRECOGNIZETEXTREQUEST",
    toolVersion: ProcessInfo.processInfo.operatingSystemVersionString,
    recognitionLevel: "ACCURATE",
    languages: ["en-US", "ko-KR"],
    images: images
)
let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
do {
    let payload = try encoder.encode(result)
    FileHandle.standardOutput.write(payload)
    FileHandle.standardOutput.write(Data("\n".utf8))
} catch {
    FileHandle.standardError.write(Data("OCR result encoding failed: \(error)\n".utf8))
    exit(4)
}
