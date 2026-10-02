package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

//go:embed index.html style.css app.js run-controls.js features-ui.js member-ui.js chat-ui.js progress-sync.js core.js basics-ui.js game-effects.js game-effects.css guide-ui.js guide.css qrcode.min.js study-core.js study-ui.js study-ui.css study-practice.js study-practice.css study-speaking.js study-speaking.css manifest.webmanifest app-icon.svg service-worker.js data/words.json data/scenarios.json data/examples.json data/industries.json data/industry_words.json data/phonics.json data/grammar.json audio/phonics/p*.ogg provenance/phonics-audio.md
var assets embed.FS

func main() {
	port := flag.Int("port", 18887, "Loopback listening port")
	stateDir := flag.String("state-dir", os.TempDir()+"/english-quest-state", "Persistent site state directory")
	generateCode := flag.String("generate-code", "", "Generate a single member code: month, year, lifetime")
	listBookings := flag.Bool("list-bookings", false, "List bookings for the site operator")
	confirmBooking := flag.String("confirm-booking", "", "Confirm a booking by ID")
	confirmTime := flag.String("confirm-time", "", "Confirmed call time text")
	promoteAdmin := flag.String("promote-admin", "", "Promote registered site username to proof reviewer")
	flag.Parse()
	f, err := newFeatures(*stateDir)
	if err != nil {
		log.Fatal(err)
	}
	if *generateCode != "" {
		code, err := f.generateCode(*generateCode)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(code)
		return
	}
	if *promoteAdmin != "" {
		if err := f.promoteAdmin(*promoteAdmin); err != nil {
			log.Fatal(err)
		}
		fmt.Println("reviewer enabled")
		return
	}
	if *listBookings {
		if err := f.listBookingsAdmin(); err != nil {
			log.Fatal(err)
		}
		return
	}
	if *confirmBooking != "" {
		if err := f.confirmBooking(*confirmBooking, *confirmTime); err != nil {
			log.Fatal(err)
		}
		fmt.Println("booking confirmed")
		return
	}
	staticFiles, err := loadStaticAssets()
	if err != nil {
		log.Fatal(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/membership", f.membership)
	mux.HandleFunc("/api/account", f.accountState)
	mux.HandleFunc("/api/account/register", f.accountRegister)
	mux.HandleFunc("/api/account/login", f.accountLogin)
	mux.HandleFunc("/api/account/logout", f.accountLogout)
	mux.HandleFunc("/api/payment/plans", f.paymentCatalog)
	mux.HandleFunc("/api/payment/create", f.createPayment)
	mux.HandleFunc("/api/payment/status", f.paymentStatus)
	mux.HandleFunc("/api/payment/mock-success", f.mockPaymentSuccess)
	mux.HandleFunc("/api/payment/notify/huifu", f.paymentNotify)
	mux.HandleFunc("/api/progress", f.progressForAccount)
	mux.HandleFunc("/api/study", f.studyForAccount)
	mux.HandleFunc("/api/study/assistant", f.studyAssistant)
	mux.HandleFunc("/api/applications", f.proofMine)
	mux.HandleFunc("/api/applications/apply", f.proofApply)
	mux.HandleFunc("/api/applications/admin", f.proofAdminList)
	mux.HandleFunc("/api/applications/image", f.proofImage)
	mux.HandleFunc("/api/applications/review", f.proofReview)
	mux.HandleFunc("/api/chat", f.chatList)
	mux.HandleFunc("/api/chat/post", f.chatPost)
	mux.HandleFunc("/api/chat/report", f.chatReport)
	mux.HandleFunc("/api/chat/block", f.chatBlock)
	mux.HandleFunc("/api/chat/moderate", f.chatModerate)
	mux.HandleFunc("/api/redeem", f.redeem)
	mux.HandleFunc("/api/codes/create", f.createMemberCode)
	mux.HandleFunc("/api/community", f.communityInfo)
	mux.HandleFunc("/api/community/settings", f.communityUpdate)
	mux.HandleFunc("/api/bookings", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			f.bookingMine(w, r)
		} else if r.Method == http.MethodPost {
			f.bookingCreate(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/bookings/admin", f.bookingAdminList)
	mux.HandleFunc("/api/bookings/review", f.bookingReview)
	mux.HandleFunc("/api/daily", f.dailyQuiz)
	mux.HandleFunc("/api/daily/submit", f.dailySubmit)
	mux.HandleFunc("/api/daily/attempt", f.dailyAttempt)
	mux.HandleFunc("/api/daily/leaderboard", f.leaderboard)
	mux.HandleFunc("/api/industries", f.industryCatalog)
	mux.HandleFunc("/api/industries/challenge", f.industryQuiz)
	mux.HandleFunc("/api/industries/submit", f.industrySubmit)
	mux.HandleFunc("/api/industries/leaderboard", f.industryLeaderboard)
	mux.HandleFunc("/api/race/status", f.raceStatus)
	mux.HandleFunc("/api/race/join", f.raceJoin)
	mux.HandleFunc("/api/race/room/create", f.raceRoomCreate)
	mux.HandleFunc("/api/race/room/join", f.raceRoomJoin)
	mux.HandleFunc("/api/race/answer", f.raceAnswer)
	mux.HandleFunc("/api/race/forfeit", f.raceForfeit)
	mux.HandleFunc("/api/race/cancel", f.raceCancel)
	mux.HandleFunc("/api/duo/status", f.duoStatus)
	mux.HandleFunc("/api/duo/create", f.duoCreate)
	mux.HandleFunc("/api/duo/join", f.duoJoin)
	mux.HandleFunc("/api/duo/leave", f.duoLeave)
	mux.HandleFunc("/api/duo/practice/start", f.duoPracticeStart)
	mux.HandleFunc("/api/duo/practice/answer", f.duoPracticeAnswer)
	mux.HandleFunc("/api/duo/practice/stop", f.duoPracticeStop)
	mux.HandleFunc("/api/duo/race/join", f.duoRaceJoin)
	mux.HandleFunc("/api/duo/race/room/create", f.duoRoomCreate)
	mux.HandleFunc("/api/duo/race/room/join", f.duoRoomJoin)
	mux.HandleFunc("/api/duo/race/answer", f.duoRaceAnswer)
	mux.HandleFunc("/api/duo/race/cancel", f.duoRaceCancel)
	mux.HandleFunc("/api/duo/race/forfeit", f.duoRaceForfeit)
	mux.HandleFunc("/api/friends/status", f.friendStatus)
	mux.HandleFunc("/api/friends/profile", f.friendProfileUpdate)
	mux.HandleFunc("/api/friends/request", f.friendRequestCreate)
	mux.HandleFunc("/api/friends/accept", f.friendRequestAccept)
	mux.HandleFunc("/api/friends/decline", f.friendRequestDecline)
	mux.HandleFunc("/api/friends/remove", f.friendRemove)
	mux.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"ok": true, "service": "english-quest", "version": "1.32.1", "words": 20000, "levels": 2000, "goals": mainGoals(), "scenario_missions": 12, "phrases": 120, "tracks": len(f.industries), "industry_tracks": 10, "exam_tracks": 7, "progress_storage": "browser-local-and-account-cloud", "permanent_leaderboard": true, "proof_applications": true, "member_bookings": true, "live_races": true, "duo_teams": true, "friends": true, "chat_channels": len(chatChannels), "personal_study_tools": true, "dictation": true, "sentence_shadowing": true, "oral_dialogue": true, "phonics": 44, "grammar_points": 36, "payment": paymentSummary(f)})
	})
	mux.HandleFunc("/", serveStatic(staticFiles))
	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	log.Printf("English Quest listening on %s", addr)
	srv := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	log.Fatal(srv.ListenAndServe())
}
