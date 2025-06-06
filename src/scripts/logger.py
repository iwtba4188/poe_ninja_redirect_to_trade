import logging
import sys
import time
from pathlib import Path

import colorama
from colorama import Fore, Style

# 初始化 colorama，確保在 Windows 上也能正常顯示顏色
colorama.init()

# 全域變數來管理共享的檔案處理器
_shared_file_handler = None
_shared_log_file = None


class ColoredFormatter(logging.Formatter):
    """
    彩色日誌格式化器，為不同級別的日誌輸出不同顏色
    原文链接：https://blog.csdn.net/yue81560/article/details/130467590
    """

    COLOR_MAP = {
        logging.DEBUG: Style.DIM + Fore.WHITE,
        logging.INFO: Fore.GREEN,
        logging.WARNING: Fore.YELLOW,
        logging.ERROR: Fore.RED,
        logging.CRITICAL: Style.BRIGHT + Fore.RED,
    }
    converter = time.localtime

    def __init__(self, fmt=None, datefmt=None, style="%", validate=True):
        super().__init__(fmt, datefmt, style, validate)

    def format(self, record):
        """格式化日誌記錄，添加顏色"""
        log_color = self.COLOR_MAP.get(record.levelno, "")
        msg = super().format(record)
        if log_color:
            msg = msg.replace(
                record.levelname, f"{log_color}{record.levelname}{Style.RESET_ALL}"
            )
        return msg


class ColoredLogger(logging.Logger):
    """
    彩色日誌記錄器，同時支援控制台彩色輸出和檔案記錄
    多個 logger 實例共享同一個日誌檔案
    """

    def __init__(self, name, level=logging.INFO, log_dir="./logs"):
        super().__init__(name, level)

        # 確保日誌目錄存在
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)

        # 設置格式
        self.format_str = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"
        self.date_format = "%Y-%m-%d %H:%M:%S"

        # 添加控制台處理器（彩色）
        self._add_console_handler()

        # 添加共享檔案處理器
        self._add_shared_file_handler()

    def _add_console_handler(self):
        """添加控制台處理器，支援彩色輸出"""
        console_handler = logging.StreamHandler(sys.stdout)
        console_formatter = ColoredFormatter(
            self.format_str,
            datefmt=self.date_format,
        )
        console_handler.setFormatter(console_formatter)
        self.addHandler(console_handler)

    def _add_shared_file_handler(self):
        """添加共享檔案處理器，多個 logger 寫入同一個檔案"""
        global _shared_file_handler, _shared_log_file

        if _shared_file_handler is None:
            # 創建共享的日誌檔案
            timestamp = time.strftime("%Y-%m-%d_%H-%M-%S")
            _shared_log_file = self.log_dir / f"shared_{timestamp}.log"

            _shared_file_handler = logging.FileHandler(
                _shared_log_file, mode="a", encoding="utf-8"
            )
            file_formatter = logging.Formatter(
                self.format_str,
                datefmt=self.date_format,
            )
            _shared_file_handler.setFormatter(file_formatter)

            # 記錄日誌檔案位置（只記錄一次）
            print(f"Shared log file created: {_shared_log_file}")

        # 添加共享的檔案處理器到當前 logger
        self.addHandler(_shared_file_handler)


def setup_logging(name=__name__, level=logging.INFO, log_dir="./logs"):
    """
    設置並返回一個彩色日誌記錄器

    Args:
        name: 日誌記錄器名稱
        level: 日誌級別
        log_dir: 日誌檔案目錄

    Returns:
        ColoredLogger: 配置好的彩色日誌記錄器
    """
    # 設置自定義日誌記錄器類
    logging.setLoggerClass(ColoredLogger)
    logger = logging.getLogger(name)

    # 避免重複添加處理器
    if not logger.handlers:
        logger.__init__(name, level, log_dir)

    return logger


def get_logger(name=__name__, level=logging.INFO, log_dir="./logs"):
    """
    獲取日誌記錄器的便利函數

    Args:
        name: 日誌記錄器名稱
        level: 日誌級別
        log_dir: 日誌檔案目錄

    Returns:
        ColoredLogger: 日誌記錄器實例
    """
    return setup_logging(name, level, log_dir)


# # 創建默認的日誌記錄器
# logger = get_logger("Logger")

# 測試日誌輸出
if __name__ == "__main__":
    print("=== 測試共享檔案模式 ===")
    # 創建不同名字的 logger，但都寫入同一個共享檔案
    logger1 = get_logger("Database")
    logger2 = get_logger("Network")
    logger3 = get_logger("FileHandler")

    # 測試不同 logger 的輸出
    logger1.info("資料庫連接成功")
    logger2.warning("網路連接緩慢")
    logger3.error("檔案讀取失敗")

    logger1.debug("執行 SQL 查詢")
    logger2.info("發送 HTTP 請求")
    logger3.critical("磁碟空間不足")

    print("\n" + "=" * 50)
    print("以上所有日誌都會寫入同一個共享檔案中")
    print("但每個 logger 的 name 欄位會顯示不同的名字")
    print("=" * 50)

    # 顯示實際使用方法
    print("\n=== 使用方法 ===")
    print("from logger import get_logger")
    print("")
    print("# 創建不同模組的 logger")
    print("db_logger = get_logger('Database')")
    print("api_logger = get_logger('API')")
    print("file_logger = get_logger('FileHandler')")
    print("")
    print("# 它們都會寫入同一個共享檔案，但 name 欄位不同")
    print("db_logger.info('數據庫操作完成')")
    print("api_logger.warning('API 響應時間過長')")
    print("file_logger.error('檔案未找到')")
    print("=" * 50)
