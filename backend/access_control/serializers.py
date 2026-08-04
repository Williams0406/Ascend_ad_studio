from rest_framework import serializers
from accounts.models import User, Workspace, WorkspaceMember
from .models import PolicyMode


class UserPolicyUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=User._meta.get_field("status").choices, required=False)
    access_mode = serializers.ChoiceField(choices=PolicyMode.choices, required=False)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True)


class WorkspacePolicyUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Workspace.STATUSES, required=False)
    access_mode = serializers.ChoiceField(choices=PolicyMode.choices, required=False)
    seat_limit_override = serializers.IntegerField(required=False, allow_null=True, min_value=1)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    reason = serializers.CharField(required=False, allow_blank=True)


class MemberUpdateSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=WorkspaceMember.ROLES, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Envía role o is_active para actualizar el miembro.")
        return attrs
