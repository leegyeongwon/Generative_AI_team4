from typing import Optional

from fastapi import APIRouter, File, UploadFile


router = APIRouter(prefix="/api/csr", tags=["csr"])


@router.post("/recognize")
async def recognize(
    audio_file: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
):
    # Placeholder: 실제 Naver CSR 연동 시 upload.file을 음성 인식 API로 전달합니다.
    upload = audio_file or file
    if upload is None:
        return {
            "success": False,
            "error_code": "NO_FILE",
            "message": "음성 파일이 필요합니다.",
        }
    _ = upload.filename
    return {
        "success": True,
        "text": "서울 강남구에서 휘발유 제일 싼 주유소 찾아줘",
        "message": "CSR 연동 예정",
    }
