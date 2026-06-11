#include "crash_handler.h"

#include <websocketpp/error.hpp>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <execinfo.h>
#include <signal.h>
#include <unistd.h>

namespace {

constexpr int kMaxFrames = 64;

// Async-signal-safe: write a C-string to fd.
void safe_write(int fd, const char *s) {
    if (!s) return;
    size_t len = 0;
    while (s[len]) ++len;
    ssize_t r = write(fd, s, len);
    (void)r;
}

// Async-signal-safe: write integer to fd.
void safe_write_int(int fd, long v) {
    char buf[32];
    int n = 0;
    if (v < 0) {
        char minus = '-';
        ssize_t r = write(fd, &minus, 1);
        (void)r;
        v = -v;
    }
    if (v == 0) buf[n++] = '0';
    char tmp[32];
    int t = 0;
    while (v > 0) {
        tmp[t++] = '0' + (v % 10);
        v /= 10;
    }
    while (t > 0) buf[n++] = tmp[--t];
    ssize_t r = write(fd, buf, n);
    (void)r;
}

const char *signame(int sig) {
    switch (sig) {
        case SIGSEGV: return "SIGSEGV (segmentation fault)";
        case SIGBUS:  return "SIGBUS (bus error)";
        case SIGFPE:  return "SIGFPE (floating-point exception)";
        case SIGILL:  return "SIGILL (illegal instruction)";
        case SIGABRT: return "SIGABRT (abort)";
        case SIGPIPE: return "SIGPIPE (broken pipe)";
        case SIGTERM: return "SIGTERM";
        case SIGINT:  return "SIGINT";
        default:      return "signal";
    }
}

// Fatal-signal handler: print banner + backtrace, then re-raise default to
// produce a core dump (and let the parent shell observe the real exit cause).
extern "C" void crash_signal_handler(int sig, siginfo_t *info, void * /*ucontext*/) {
    safe_write(STDERR_FILENO,
               "\n"
               "================================================================\n"
               "[CRASH] spectrumserver received fatal signal: ");
    safe_write(STDERR_FILENO, signame(sig));
    safe_write(STDERR_FILENO, " (signo=");
    safe_write_int(STDERR_FILENO, sig);
    safe_write(STDERR_FILENO, ")\n");

    if (info) {
        safe_write(STDERR_FILENO, "[CRASH] si_code=");
        safe_write_int(STDERR_FILENO, info->si_code);
        safe_write(STDERR_FILENO, " si_addr=0x");
        char hex[32];
        unsigned long v = reinterpret_cast<unsigned long>(info->si_addr);
        int hn = 0;
        if (v == 0) hex[hn++] = '0';
        char tmp[32];
        int t = 0;
        while (v > 0) {
            unsigned d = v & 0xF;
            tmp[t++] = (d < 10) ? ('0' + d) : ('a' + (d - 10));
            v >>= 4;
        }
        while (t > 0) hex[hn++] = tmp[--t];
        ssize_t r = write(STDERR_FILENO, hex, hn);
        (void)r;
        safe_write(STDERR_FILENO, " pid=");
        safe_write_int(STDERR_FILENO, getpid());
        safe_write(STDERR_FILENO, "\n");
    }

    safe_write(STDERR_FILENO, "[CRASH] Backtrace:\n");
    void *frames[kMaxFrames];
    int n = backtrace(frames, kMaxFrames);
    backtrace_symbols_fd(frames, n, STDERR_FILENO);

    safe_write(STDERR_FILENO,
               "================================================================\n"
               "[CRASH] Re-raising default handler so a core dump can be produced.\n"
               "[CRASH] To get a core dump, run:    ulimit -c unlimited\n"
               "[CRASH] Then inspect with:          gdb ./build/spectrumserver core\n"
               "================================================================\n");

    // Restore default handler and re-raise to terminate (and core-dump).
    struct sigaction sa{};
    sa.sa_handler = SIG_DFL;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(sig, &sa, nullptr);
    raise(sig);
    _exit(128 + sig);
}

// Less-fatal: SIGPIPE just gets a one-shot warning then is ignored — pipes
// closing should not kill the server.
extern "C" void sigpipe_warn_handler(int /*sig*/) {
    static int seen = 0;
    if (!seen) {
        seen = 1;
        safe_write(STDERR_FILENO,
                   "[WARN] SIGPIPE received (broken pipe). Further SIGPIPEs will be ignored.\n");
    }
}

void install_one(int sig, void (*handler)(int, siginfo_t *, void *)) {
    struct sigaction sa{};
    sa.sa_sigaction = handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = SA_SIGINFO | SA_RESETHAND;
    sigaction(sig, &sa, nullptr);
}

void terminate_handler() {
    fprintf(stderr,
            "\n================================================================\n"
            "[TERMINATE] std::terminate() called.\n");
    if (auto eptr = std::current_exception()) {
        try {
            std::rethrow_exception(eptr);
        } catch (const std::exception &e) {
            fprintf(stderr, "[TERMINATE] uncaught exception: %s\n", e.what());
            if (const auto *wpx =
                    dynamic_cast<const websocketpp::exception *>(&e)) {
                const websocketpp::lib::error_code &ec = wpx->code();
                fprintf(stderr,
                        "[TERMINATE] websocketpp error_code: category=%s "
                        "value=%i message=%s\n",
                        ec.category().name(),
                        ec.value(),
                        ec.message().c_str());
            }
        } catch (...) {
            fprintf(stderr, "[TERMINATE] uncaught non-std exception\n");
        }
    } else {
        fprintf(stderr, "[TERMINATE] no active exception\n");
    }
    fprintf(stderr,
            "[TERMINATE] Backtrace:\n");
    fflush(stderr);
    void *frames[kMaxFrames];
    int n = backtrace(frames, kMaxFrames);
    backtrace_symbols_fd(frames, n, STDERR_FILENO);
    fprintf(stderr,
            "================================================================\n");
    fflush(stderr);
    std::abort();
}

} // namespace

void install_crash_handlers() {
    install_one(SIGSEGV, crash_signal_handler);
    install_one(SIGBUS,  crash_signal_handler);
    install_one(SIGFPE,  crash_signal_handler);
    install_one(SIGILL,  crash_signal_handler);
    install_one(SIGABRT, crash_signal_handler);

    struct sigaction sa{};
    sa.sa_handler = sigpipe_warn_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    sigaction(SIGPIPE, &sa, nullptr);

    std::set_terminate(terminate_handler);
}
