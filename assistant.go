package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

var assistantQuota = struct {
	sync.Mutex
	day   string
	users map[string]int
	total int
}{users: map[string]int{}}

func (f *features) studyAssistant(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", 405)
		return
	}
	if !sameOrigin(r) {
		http.Error(w, "request denied", 403)
		return
	}
	f.mu.Lock()
	a := f.accountFromRequest(r)
	var id string
	if a != nil {
		id = a.ID
	}
	f.mu.Unlock()
	if id == "" {
		http.Error(w, "请先登录，再使用AI学习助手。", 401)
		return
	}
	if owner := r.Header.Get("X-Study-Owner"); owner != "" && owner != id {
		http.Error(w, "账号已切换，请刷新后再发送。", 403)
		return
	}
	key := os.Getenv("ENGLISH_AI_API_KEY")
	base := strings.TrimRight(os.Getenv("ENGLISH_AI_BASE_URL"), "/")
	model := os.Getenv("ENGLISH_AI_MODEL")
	if key == "" || base == "" || model == "" {
		http.Error(w, "AI服务尚未配置。词句库、听写和跟读可以正常使用。", 503)
		return
	}
	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil {
		http.Error(w, "AI服务配置无效，请联系站长。", 503)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 18000)
	var in struct {
		Mode string `json:"mode"`
		Text string `json:"text"`
	}
	dec := json.NewDecoder(r.Body)
	if dec.Decode(&in) != nil || dec.Decode(new(any)) != io.EOF || len([]rune(in.Text)) > 4000 || strings.TrimSpace(in.Text) == "" {
		http.Error(w, "请输入1到4,000字的词句或问题。", 400)
		return
	}
	tasks := map[string]string{"explain": "解释英语词句的常见用法，给两句简短双语例句。", "correct": "修改英文，保留用户原意，并简短说明语法和措辞。", "dialogue": "进行英语对话。先用简短英语回应，再给一句中文提示；温和指出明显错误。", "quiz": "根据用户输入的文本出3道英语练习题，最后单独给答案与简短说明。"}
	task, ok := tasks[in.Mode]
	if !ok {
		http.Error(w, "请选择一种练习方式。", 400)
		return
	}
	assistantQuota.Lock()
	today := time.Now().UTC().Format("2006-01-02")
	if today != assistantQuota.day {
		assistantQuota.day = today
		assistantQuota.users = map[string]int{}
		assistantQuota.total = 0
	}
	if assistantQuota.users[id] >= 30 || assistantQuota.total >= 300 {
		assistantQuota.Unlock()
		http.Error(w, "今天的AI练习次数已用完，明天再继续。", 429)
		return
	}
	assistantQuota.users[id]++
	assistantQuota.total++
	assistantQuota.Unlock()
	answer, err := requestStudyAssistant(r, base+"/responses", key, model, task, in.Text, &http.Client{Timeout: 25 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }})
	if err != nil {
		http.Error(w, "AI暂时没能回答，请稍后再试。", 502)
		return
	}
	writeJSON(w, map[string]string{"answer": answer})
}

func requestStudyAssistant(parent *http.Request, endpoint, key, model, task, input string, client *http.Client) (string, error) {
	payload, _ := json.Marshal(map[string]any{"model": model, "store": false, "reasoning": map[string]string{"effort": "low"}, "max_output_tokens": 1400, "instructions": "你是英语学习教练。用简洁中文与自然英语回答。" + task + "不要假称完成发音评分。医学、法律、金融仅解释英语，不提供专业决定建议。", "input": input})
	req, err := http.NewRequestWithContext(parent.Context(), "POST", endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	response, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		io.Copy(io.Discard, io.LimitReader(response.Body, 8192))
		return "", io.ErrUnexpectedEOF
	}
	var result struct {
		Output []struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
		OutputText string `json:"output_text"`
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, 256001))
	if err != nil || len(data) > 256000 {
		return "", io.ErrUnexpectedEOF
	}
	if json.Unmarshal(data, &result) != nil {
		return "", io.ErrUnexpectedEOF
	}
	var parts []string
	for _, item := range result.Output {
		for _, content := range item.Content {
			if content.Type == "output_text" && content.Text != "" {
				parts = append(parts, content.Text)
			}
		}
	}
	if len(parts) == 0 && result.OutputText != "" {
		parts = append(parts, result.OutputText)
	}
	answer := strings.TrimSpace(strings.Join(parts, "\n"))
	if answer == "" || len(answer) > 60000 {
		return "", io.ErrUnexpectedEOF
	}
	return answer, nil
}
