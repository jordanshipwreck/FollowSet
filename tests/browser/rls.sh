#!/usr/bin/env bash
# Applies supabase/migrations to a throwaway Postgres 16 (with stub auth/storage schemas) and probes RLS.
# Usage: sudo bash tests/browser/rls.sh   (needs a local postgres install; runs initdb as the postgres user)
set -u
HERE=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$HERE/../.." && pwd)
B=$(ls -d /usr/lib/postgresql/*/bin | tail -1); D=$(mktemp -d /tmp/fs-pg.XXXX); chown postgres "$D"; chmod 755 "$D"
trap 'su postgres -c "$B/pg_ctl -D $D/data stop" >/dev/null 2>&1; rm -rf "$D"' EXIT
su postgres -c "$B/initdb -D $D/data -A trust >/dev/null && $B/pg_ctl -D $D/data -o '-p 5499 -k $D' -l $D/log start >/dev/null"; sleep 2
cp "$HERE"/rls-*.sql "$ROOT"/supabase/migrations/*.sql "$D"/ && chmod 644 "$D"/*.sql
P="psql -h $D -p 5499 -U postgres -v ON_ERROR_STOP=1 -q"
$P -c "create database t" && $P -d t -f "$D/rls-stub.sql" && for m in "$D"/2*.sql; do $P -d t -f "$m" || exit 1; done && $P -d t -f "$D/rls-grants.sql" && echo "migration applies"
P="psql -h $D -p 5499 -U postgres -d t -q -t -A"
A=11111111-1111-1111-1111-111111111111; Bu=22222222-2222-2222-2222-222222222222; fails=0
as() { echo "set role $1; select set_config('request.jwt.claim.sub', '$2', false); $3" | $P 2>&1 | tail -1; }
t() { r=$(as "$1" "$2" "$3"); if echo "$r" | grep -q -- "$4"; then echo "ok   $5"; else echo "FAIL $5 -> $r"; fails=$((fails+1)); fi; }
t authenticated $A "insert into programs (id, creator_id, title, published) values ('pa','$A','A draft',false); insert into programs (id, creator_id, title, published) values ('pb','$A','A live',true); select count(*) from programs;" "^2$" "creator inserts own programs"
t authenticated $Bu "insert into programs (id, creator_id, title) values ('px','$A','forged');" "row-level security" "cannot insert a program as someone else"
t authenticated $Bu "select string_agg(id, ',') from programs;" "^pb$" "others see only published"
t anon "" "select string_agg(id, ',') from programs;" "^pb$" "anon sees only published"
t authenticated $Bu "update programs set title='hijack' where id='pb'; select title from programs where id='pb';" "^A live$" "cannot edit someone else's program"
t authenticated $Bu "delete from programs where id='pb'; select count(*) from programs where id='pb';" "^1$" "cannot delete someone else's program"
t authenticated $A "insert into user_data (user_id, data) values ('$A', '{\"v\":1}'); select count(*) from user_data;" "^1$" "own snapshot write"
t authenticated $Bu "select count(*) from user_data;" "^0$" "cannot read another user's data"
t anon "" "select count(*) from user_data;" "^0$" "anon reads no user data"
t authenticated $A "select count(*) from mcp_keys;" "^0$" "keys invisible to clients"
t authenticated $A "insert into mcp_keys (key_hash, user_id) values ('h', '$A');" "row-level security" "clients cannot mint keys"
t authenticated $A "insert into subscriptions (user_id, program_id) values ('$A','pb');" "row-level security" "clients cannot grant themselves subscriptions"
t authenticated $A "select bump_coach_usage('$A');" "permission denied" "clients cannot touch coach usage"
t postgres "" "select bump_coach_usage('$A'); select bump_coach_usage('$A');" "^2$" "usage counter increments per day"
t authenticated $A "insert into storage.objects (bucket_id, name) values ('media', '$A/v.webm'); select 'up';" "^up$" "upload into own media folder"
t authenticated $A "insert into storage.objects (bucket_id, name) values ('media', '$Bu/v.webm');" "row-level security" "cannot upload into another creator's folder"
t postgres "" "insert into suggestions (user_id, program) values ('$A', '{}'); select 1;" "^1$" "service role stores suggestion"
t authenticated $Bu "select count(*) from suggestions;" "^0$" "cannot read another user's suggestions"
t authenticated $A "update suggestions set claimed_at=now(); select count(*) from suggestions where claimed_at is not null;" "^1$" "user claims own suggestion"
t authenticated $A "insert into profiles (id, name, handle) values ('$A','Kay','coach.kay'); select handle from profiles;" "coach.kay" "own profile"
t authenticated $A "insert into profiles (id, handle) values ('$Bu','bad handle!');" "row-level security\|check constraint" "profile handle/ownership enforced"
echo; [ $fails = 0 ] && echo "ALL PASS" || echo "$fails FAILED"
