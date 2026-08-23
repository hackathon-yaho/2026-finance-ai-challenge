export function isDeadlineUrgent(notice: string | null): boolean {
  return notice === "공고 받고 50일 넘었어요" || notice === "모르겠어요"
}

export function getDeadlineNotice(notice: string | null): string | null {
  if (!notice) return null
  if (notice === "아직 공고 전이에요") {
    return "아직 공고 전이면 기한이 남아 있어요. 공고일로부터 2개월이 기한이라, 금융회사에 공고 여부를 먼저 확인해주세요."
  }
  if (notice === "공고 받고 50일 안 지났어요") {
    return "기한이 얼마 남지 않았을 수 있어요. 공고일로부터 2개월 안에 접수해주세요."
  }
  if (notice === "공고 받고 50일 넘었어요") {
    return "기한이 지났을 수 있어요. 예금채권이 소멸할 수 있으니 금융회사와 전문가 확인이 필요해요."
  }
  return "지급정지 통지서에서 날짜를 확인해주세요. 기한이 지나면 예금채권이 소멸할 수 있어요."
}
