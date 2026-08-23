/**
 * 업로드 파일 검증 (spec.md F3-02) 과 관련 상한값.
 *
 * 확장자·MIME 타입은 사용자가 위조할 수 있으므로 실제 바이트 시그니처까지 확인한다.
 * F3-02 수용 기준이 "확장자를 위조한 파일 거부"이기 때문에 타입 검사만으로는 부족하다.
 */

export const ACCEPTED_TYPES: readonly string[] = ["image/jpeg", "image/png"]

/** 파일당 10MB (F3-02 ③) */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** 세션당 누적 10장 (F3-02 ④). 초과분을 보내면 백엔드가 400을 낸다. */
export const MAX_UPLOADS = 10

/** 전송 이미지의 장변 상한 (F3-01 처리 ①) */
export const MAX_IMAGE_EDGE = 1600

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

export type RejectReason = "type" | "size" | "signature"

export const REJECT_MESSAGE: Record<RejectReason, string> = {
  type: "JPG·PNG 이미지만 올릴 수 있어요",
  size: "10MB가 넘는 파일은 올릴 수 없어요",
  signature: "이미지 파일이 아니에요",
}

function hasSignature(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte)
}

/** 통과하면 `null`, 걸리면 사유를 돌려준다. */
export async function validateImageFile(file: File): Promise<RejectReason | null> {
  if (!ACCEPTED_TYPES.includes(file.type)) return "type"
  if (file.size > MAX_FILE_BYTES) return "size"

  const header = new Uint8Array(await file.slice(0, PNG_SIGNATURE.length).arrayBuffer())
  if (!hasSignature(header, PNG_SIGNATURE) && !hasSignature(header, JPEG_SIGNATURE)) return "signature"

  return null
}
