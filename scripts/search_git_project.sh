#!/bin/bash

# ================ 配置区 ==================
# 设置你的项目根目录（修改为你自己的路径）
PROJECTS_ROOT="."

# 可选：指定要搜索的项目目录名（留空则搜索 PROJECTS_ROOT 下所有目录）
# 例如：PROJECTS=("project-a" "project-b" "my-service")
PROJECTS=()
RESULTS=()
FRONTS_PACKAGES=()
# =========================================

# ANSI color codes for highlighting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 获取搜索关键词
echo -ne "${CYAN}请输入要搜索的 commit 内容: ${NC}"
read SEARCH_TERM

# 检查关键词是否为空
if [ -z "$SEARCH_TERM" ]; then
    echo -e "${RED}错误：搜索内容不能为空！${NC}"
    exit 1
fi

echo -e "${YELLOW}🔍 正在搜索包含 '${SEARCH_TERM}' 的 commit...${NC}"
echo -e "${BLUE}==========================================${NC}"

# 定义要遍历的项目列表
if [ ${#PROJECTS[@]} -eq 0 ]; then
    # 如果未指定 PROJECTS，则使用 PROJECTS_ROOT 下的所有子目录
    mapfile -t PROJECTS < <(find "$PROJECTS_ROOT" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; | sort)
fi

# 遍历每个项目
for project in "${PROJECTS[@]}"; do
    PROJECT_PATH="$PROJECTS_ROOT/$project"
    echo -e "${CYAN}检查项目：${project}${NC}"
   
    # 检查是否为 Git 仓库
    
    if [ ! -d "${PROJECT_PATH}/.git" ]; then
    	echo -e "${YELLOW}跳过：不是 Git 仓库${NC}"
    	continue
    fi	
    
    # 进入项目目录并搜索 commit
    cd "$PROJECT_PATH" || continue

    COMMITS=$(git branch -a 2>/dev/null | grep -i ${SEARCH_TERM})

    if [ -n "$COMMITS" ]; then
        echo -e "${GREEN}$COMMITS${NC}"
	    RESULTS+=("${project}")
        if [ ${project} = "hfins-front" ]; then
          echo -e "${PURPLE}开始查找前端涉及模块${NC}"
          mapfile -t FRONTS_PACKAGES < <(git log --name-only --grep="${SEARCH_TERM}" \
            --pretty=format:"" "${SEARCH_TERM}" | grep "^packages/" | sed -E 's|^packages/([^/]+)/.*|\1|' | sort -u)
        fi
    else
	    echo -e "${YELLOW}  (无匹配的分支)${NC}"
    fi

    cd ..

    echo -e "${BLUE}------------------------------------------${NC}"
done

echo -e "${GREEN}✅ 搜索完成！结果为：${NC}"
for item in "${RESULTS[@]}"; do
	echo -e "${GREEN}${item}${NC}"
    if [ ${item} = "hfins-front" ]; then
      for package in "${FRONTS_PACKAGES[@]}"; do
        echo -e "${CYAN}  - ${package}${NC}"
      done
    fi
done	